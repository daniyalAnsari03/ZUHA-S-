/**
 * READ-ONLY diagnostic: fetch actual notification-linked URLs (admin order
 * detail and customer order detail) through the running app with real auth
 * cookies, to reproduce the "Page not found" notification 404.
 */
import "./load-env.mjs";
import {
  createDisposableCustomer,
  createDisposableOrder,
  createDisposableProduct,
  deleteDisposableCustomer,
  deleteDisposableProduct,
  projectRef,
  queryRows,
  serviceGet,
  servicePost,
  signIn,
} from "./lib/harness.mjs";

const { APP_URL, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

async function main() {
  const adminAuth = await signIn(ADMIN_EMAIL, ADMIN_PASSWORD);
  if (!adminAuth.access_token) throw new Error("admin login failed");
  const adminCookie =
    `sb-${projectRef()}-auth-token=` +
    encodeURIComponent(
      JSON.stringify({
        access_token: adminAuth.access_token,
        refresh_token: adminAuth.refresh_token,
        expires_in: adminAuth.expires_in,
        expires_at: adminAuth.expires_at,
        token_type: "bearer",
        user: adminAuth.user,
      }),
    );

  console.log("== 1. Admin — real order-linked notifications ==");
  const adminNotes = await queryRows(
    "notifications",
    `user_id=eq.${adminAuth.user.id}&order_id=not.is.null`,
    "order=created_at.desc&limit=5",
  ).catch(() => []);
  const adminRows = Array.isArray(adminNotes) ? adminNotes : [];
  console.log(`admin order-linked notifications found: ${adminRows.length}`);
  for (const n of adminRows) {
    const url = `${APP_URL}/admin/orders/${n.order_id}`;
    const res = await fetch(url, { headers: { Cookie: adminCookie } });
    console.log(
      `  [${res.status}] ${n.type} -> ${url.startsWith(APP_URL) ? url.slice(APP_URL.length) : url}`,
    );
  }

  console.log("\n== 2. Customer — order detail via notification link flow ==");
  const cust = await createDisposableCustomer();
  const prod = await createDisposableProduct({ price: 5000, stock: 5 });
  const order = await createDisposableOrder({
    customerId: cust.userId,
    customerName: cust.fullName,
    customerEmail: cust.email,
    productId: prod.id,
    productName: prod.name,
    productPrice: 5000,
  });

  const orderUrl = `${APP_URL}/orders/${order.id}`;
  const res = await fetch(orderUrl, {
    headers: { Cookie: cust.cookie },
    redirect: "follow",
  });
  console.log(`customer order detail via notification link: [${res.status}]`);
  if (res.redirected) console.log(`  redirected to: ${res.url}`);
  const html = await res.text();
  if (/Page not found|not-found|404/i.test(html) && res.status === 404) {
    console.log("  => 404 CONFIRMED on customer order detail");
  } else {
    console.log(
      `  => status ok (${/Order Detail/.test(html) ? "Order Detail page rendered" : "content unclear"})`,
    );
  }

  console.log("\n== 3. Admin — fresh order detail through app ==");
  const adminOrderUrl = `${APP_URL}/admin/orders/${order.id}`;
  const res3 = await fetch(adminOrderUrl, { headers: { Cookie: adminCookie } });
  console.log(`admin order detail: [${res3.status}]`);

  await deleteDisposableCustomer(cust.userId).catch(() => {});
  await deleteDisposableProduct(prod.id).catch(() => {});
}

main().catch((e) => {
  console.error("probe failed:", e.message);
  process.exit(1);
});

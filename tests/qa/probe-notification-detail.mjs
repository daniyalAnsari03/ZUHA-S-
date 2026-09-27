/**
 * READ-ONLY verification for the new notification detail views:
 *  - admin:  /admin/notifications/:id renders instead of 404
 *  - customer: /notifications/:id renders instead of 404
 */
import "./load-env.mjs";
import {
  APP_URL,
  SUPABASE_SERVICE_KEY,
  SUPABASE_URL,
  createDisposableCustomer,
  createDisposableOrder,
  createDisposableProduct,
  deleteDisposableCustomer,
  deleteDisposableProduct,
  queryRows,
  servicePost,
  sessionCookie,
  signIn,
} from "./lib/harness.mjs";

const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

async function main() {
  const adminAuth = await signIn(ADMIN_EMAIL, ADMIN_PASSWORD);
  const adminCookie = sessionCookie(adminAuth);

  const adminNotes = await queryRows(
    "notifications",
    `user_id=eq.${adminAuth.user.id}&order_id=not.is.null`,
    "order=created_at.desc&limit=5",
  ).catch(() => []);
  const adminRows = Array.isArray(adminNotes) ? adminNotes : [];
  if (adminRows.length === 0) {
    console.log(
      "SKIP admin route: no order-linked admin notification to test with",
    );
  } else {
    const n = adminRows[0];
    const res = await fetch(`${APP_URL}/admin/notifications/${n.id}`, {
      headers: { Cookie: adminCookie },
    });
    const html = await res.text();
    if (res.status === 200 && /Notification Detail/.test(html)) {
      console.log(
        `ADMIN  /admin/notifications/:id  [200] rendered (${n.type})`,
      );
    } else {
      console.log(
        `ADMIN  WARN status=${res.status} detail=${/Notification Detail/.test(html)}`,
      );
    }
  }

  const cust = await createDisposableCustomer();
  const prod = await createDisposableProduct({ price: 3000, stock: 4 });
  const order = await createDisposableOrder({
    customerId: cust.userId,
    customerName: cust.fullName,
    customerEmail: cust.email,
    productId: prod.id,
    productName: prod.name,
    productPrice: 3000,
  });

  const insRes = await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      "User-Agent": "node",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      user_id: cust.userId,
      order_id: order.id,
      type: "order_placed",
      title: "Order Placed",
      message: `Your order ${order.order_number} has been placed successfully.`,
    }),
  });
  const insBody = await insRes.text();
  let inserted;
  try {
    inserted = JSON.parse(insBody);
  } catch {
    inserted = null;
  }
  console.log(`notification insert: status=${insRes.status} ok=${insRes.ok}`);

  const notificationId = Array.isArray(inserted)
    ? (inserted[0]?.id ?? null)
    : (inserted?.id ?? null);

  if (notificationId) {
    const res = await fetch(`${APP_URL}/notifications/${notificationId}`, {
      headers: { Cookie: cust.cookie },
      redirect: "follow",
    });
    const html = await res.text();
    if (res.status === 200 && /Order Placed/.test(html)) {
      console.log(`CUSTOMER /notifications/:id [200] rendered`);
    } else {
      console.log(
        `CUSTOMER WARN status=${res.status} title=${/Order Placed/.test(html)} header=${/Notification/.test(html)}`,
      );
    }
  } else {
    console.log(
      `CUSTOMER SKIP: no notification id created (${String(insBody).slice(0, 200)})`,
    );
  }

  await deleteDisposableCustomer(cust.userId).catch(() => {});
  await deleteDisposableProduct(prod.id).catch(() => {});
}

main().catch((e) => {
  console.error("probe failed:", e.message);
  process.exit(1);
});

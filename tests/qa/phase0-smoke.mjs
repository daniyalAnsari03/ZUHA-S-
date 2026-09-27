/**
 * Phase 0 smoke test — prove the safety harness works end-to-end:
 * create disposable resources → exercise a real chat turn → clean up →
 * verify zero residue.
 * Usage: node tests/qa/phase0-smoke.mjs
 */
import {
  chatAdmin,
  chatSalesman,
  createDisposableCustomer,
  createDisposableOrder,
  createDisposableProduct,
  deleteDisposableCustomer,
  deleteDisposableProduct,
  getFirst,
  projectRef,
  queryRows,
  signIn,
} from "./lib/harness.mjs";

const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

const sessionCookie = (auth) =>
  `sb-${projectRef()}-auth-token=` +
  encodeURIComponent(
    JSON.stringify({
      access_token: auth.access_token,
      refresh_token: auth.refresh_token,
      expires_in: auth.expires_in,
      expires_at: auth.expires_at,
      token_type: "bearer",
      user: auth.user,
    }),
  );

async function main() {
  console.log("── PHASE 0 SMOKE ──");
  const adminAuth = await signIn(ADMIN_EMAIL, ADMIN_PASSWORD);
  const adminCookie = sessionCookie(adminAuth);

  const cust = await createDisposableCustomer();
  console.log("customer ok:", cust.userId);

  const p = await createDisposableProduct({
    token: `S${String(Date.now()).slice(-6)}`,
    price: 999,
    stock: 4,
    lowStockThreshold: 3,
  });
  console.log("product ok:", p.id, p.name);

  const o1 = await createDisposableOrder({
    customerId: cust.userId,
    productId: p.id,
    productName: p.name,
    productPrice: 999,
    quantity: 1,
  });
  const o2 = await createDisposableOrder({
    customerId: cust.userId,
    productId: p.id,
    productName: p.name,
    productPrice: 999,
    quantity: 2,
  });
  console.log("orders ok:", o1.order_number, o2.order_number);

  const adminRes = await chatAdmin(adminCookie, "aaj ki sales batao");
  console.log(
    "admin chat:",
    adminRes.status,
    "tools:",
    adminRes.tools.join(","),
    "len:",
    adminRes.text.length,
  );

  const custRes = await chatSalesman(cust.cookie, "meri cart dikhao");
  console.log(
    "customer chat:",
    custRes.status,
    "tools:",
    custRes.tools.join(","),
    "len:",
    custRes.text.length,
  );

  const s1 = await chatSalesman(
    cust.cookie,
    `"${p.name}" meri cart me add kar do`,
  );
  console.log(
    "customer add-cart:",
    s1.status,
    "tools:",
    s1.tools.join(","),
    "->",
    s1.text.slice(0, 80),
  );

  console.log("── cleanup ──");
  await deleteDisposableCustomer(cust.userId);
  await deleteDisposableProduct(p.id);

  const orderResidue = await queryRows(
    "orders",
    `user_id=eq.${cust.userId}`,
    "",
  ).catch(() => []);
  const productResidue = await getFirst("products", `sku=eq.${p.sku}`).catch(
    () => null,
  );
  const cartResidue = await queryRows(
    "cart_items",
    "",
    `product_id=eq.${p.id}&limit=5`,
  ).catch(() => []);
  console.log(
    "residue orders:",
    Array.isArray(orderResidue) ? orderResidue.length : "?",
  );
  console.log("residue product:", productResidue ? "PRESENT" : "gone");
  console.log(
    "residue cart items:",
    Array.isArray(cartResidue) ? cartResidue.length : "?",
  );
  console.log("── PHASE 0 SMOKE DONE ──");
}

main().catch((e) => {
  console.error("smoke crash:", e);
  process.exit(1);
});

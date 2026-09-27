/**
 * Isolated A14 repro — fresh disposable customer + 2 pending disposable orders,
 * prints raw NDJSON so we can see the exact list_all_orders tool args/errors.
 * Usage: node tests/qa/isolate-bulk.mjs
 */
import {
  chatAdmin,
  createDisposableCustomer,
  createDisposableOrder,
  createDisposableProduct,
  deleteDisposableCustomer,
  deleteDisposableProduct,
  projectRef,
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
  const auth = await signIn(ADMIN_EMAIL, ADMIN_PASSWORD);
  const cookie = sessionCookie(auth);
  const cust = await createDisposableCustomer();
  const p = await createDisposableProduct({
    token: `B${String(Date.now()).slice(-6)}`,
    price: 4567,
    stock: 5,
    lowStockThreshold: 3,
  });
  const o1 = await createDisposableOrder({
    customerId: cust.userId,
    customerName: cust.fullName,
    customerEmail: cust.email,
    productId: p.id,
    productName: p.name,
    productPrice: 4567,
    quantity: 1,
  });
  const o2 = await createDisposableOrder({
    customerId: cust.userId,
    customerName: cust.fullName,
    customerEmail: cust.email,
    productId: p.id,
    productName: p.name,
    productPrice: 4567,
    quantity: 2,
  });
  console.log("cust:", cust.fullName, cust.email);
  console.log("orders:", o1.order_number, o2.order_number);

  const msg = `Customer "${cust.fullName}" (email ${cust.email}) ke saare pending orders ki status confirmed kar do (bulk update).`;
  const res = await chatAdmin(cookie, msg);
  console.log("\n=== TEXT ===");
  console.log(res.text);
  console.log("\n=== TOOL EVENTS ===");
  for (const ev of res.toolEvents) {
    console.log(`- ${ev.name} [${ev.state}]`);
    if (ev.input != null)
      console.log(`    in : ${String(ev.input).slice(0, 400)}`);
    if (ev.output != null)
      console.log(`    out: ${String(ev.output).slice(0, 400)}`);
  }

  let after = null;
  const pendingCount = [o1, o2].filter(
    (o) => (res.meta ?? {}).conversationId,
  ).length;
  const asksConfirm = /confirm/i.test(res.text);
  console.log("\nasksConfirm:", asksConfirm);
  if (asksConfirm) {
    const t2 = await chatAdmin(
      cookie,
      "Haan, confirm karta hoon. Saare orders confirm kar do.",
      res.conversationId,
    );
    console.log("\n=== TURN2 TEXT ===");
    console.log(t2.text);
    console.log("\n=== TURN2 TOOL EVENTS ===");
    for (const ev of t2.toolEvents) {
      console.log(`- ${ev.name} [${ev.state}]`);
      if (ev.input != null)
        console.log(`    in : ${String(ev.input).slice(0, 400)}`);
      if (ev.output != null)
        console.log(`    out: ${String(ev.output).slice(0, 400)}`);
    }
    after = t2;
  }

  const check = await import("./lib/harness.mjs").then((h) =>
    h.queryRows(
      "orders",
      `user_id=eq.${cust.userId}`,
      "select=id,order_number,status",
    ),
  );
  console.log("\n=== DB STATUS ===");
  for (const o of check) console.log(`- ${o.order_number}: ${o.status}`);
  console.log("pendingCountVar:", pendingCount);

  await deleteDisposableCustomer(cust.userId);
  await deleteDisposableProduct(p.id);
  console.log("\ncleaned.");
}

main().catch((e) => {
  console.error("crash:", e);
  process.exit(1);
});

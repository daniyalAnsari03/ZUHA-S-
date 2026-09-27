/**
 * READ-ONLY diagnostic: verify every notification's order_id resolves to an
 * existing order. If order_id is set but the order row is missing (or the
 * notification type implies an order link we can't render), the "View order"
 * link 404s — this pinpoints the broken notification detail route.
 */
import "./lib/harness.mjs";
import { serviceGet, queryRows } from "./lib/harness.mjs";

async function main() {
  const notifications = await queryRows(
    "notifications",
    "",
    "order=created_at.desc&limit=200",
  ).catch(() => []);

  let withOrder = 0;
  let orphaned = 0;
  const orphans = [];
  const orderCounts = new Map();

  const rows = Array.isArray(notifications) ? notifications : [];

  for (const n of rows) {
    if (n.order_id) {
      withOrder++;
      const existing = await serviceGet(
        `/rest/v1/orders?select=id,order_number&id=eq.${n.order_id}`,
      ).catch(() => []);
      const exists = Array.isArray(existing) && existing.length > 0;
      orderCounts.set(n.type, (orderCounts.get(n.type) ?? 0) + 1);
      if (!exists) {
        orphaned++;
        orphans.push({ type: n.type, order_id: n.order_id });
      }
    }
  }

  console.log(`notifications total      : ${rows.length}`);
  console.log(`notifications w/ order_id: ${withOrder}`);
  console.log(`orphaned (missing order) : ${orphaned}`);
  console.log(
    `order_id per type        : ${JSON.stringify(Object.fromEntries(orderCounts))}`,
  );
  if (orphans.length) {
    console.log("orphans:", JSON.stringify(orphans.slice(0, 20)));
  }

  const distinctTypes = new Map();
  for (const n of rows) {
    distinctTypes.set(n.type, (distinctTypes.get(n.type) ?? 0) + 1);
  }
  console.log(
    `all notification types   : ${JSON.stringify(Object.fromEntries(distinctTypes))}`,
  );
}

main().catch((e) => {
  console.error("probe failed:", e.message);
  process.exit(1);
});

// Read-only verification of the 6 orders named in docs/fix.txt #1.
import {
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
} from "./lib/harness.mjs";

const numbers = [
  "DIN-20260911-1156",
  "DIN-20260911-0786",
  "DIN-20260911-4499",
  "DIN-20260911-6751",
  "DIN-20260911-4855",
  "DIN-20260911-9727",
];

const h = {
  apikey: SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  "User-Agent": "node",
};

const q = (path) =>
  fetch(`${SUPABASE_URL}${path}`, { method: "GET", headers: h })
    .then(async (r) => (r.ok ? r.json() : { error: `${r.status} ${await r.text()}` }))
    .catch((e) => ({ error: String(e) }));

for (const n of numbers) {
  const orders = await q(
    `/rest/v1/orders?select=id,order_number,status,created_at,updated_at&order_number=eq.${n}`,
  );
  console.log("==================================================");
  if (!Array.isArray(orders) || orders.length === 0) {
    console.log(`${n}: NOT FOUND`);
    console.log(JSON.stringify(orders));
    continue;
  }
  for (const o of orders) {
    const hist = await q(
      `/rest/v1/order_status_history?select=previous_status,new_status,note,created_by,created_at&order_id=eq.${o.id}&order=created_at.asc`,
    );
    console.log(`${n} (${o.id}) status=${o.status} created=${o.created_at}`);
    console.log("  history:", JSON.stringify(hist, null, 2));
  }
}

// Also pull the audit logs referencing these order numbers to see what the AI claimed.
const audits = await q(
  `/rest/v1/ai_audit_logs?select=agent_name,tool_name,action_type,risk,status,entity_type,entity_id,detail,created_at&order=created_at.desc&limit=50`,
);
console.log("==================================================");
console.log("Recent AI audit log entries (order actions only):");
for (const a of Array.isArray(audits) ? audits : []) {
  if (/order/.test(a.action_type ?? "")) {
    console.log(
      `  ${a.created_at} agent=${a.agent_name} tool=${a.tool_name} action=${a.action_type} status=${a.status} entity=${a.entity_id}`,
      a.detail ? `detail=${JSON.stringify(a.detail)}` : "",
    );
  }
}
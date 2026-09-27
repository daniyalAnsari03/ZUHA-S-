// Discover real storefront detail routes (/orders/[id], /notifications/[id])
// using read-only service-role queries, then mint a short-lived customer
// session (magic-link token exchange) so the storefront can be audited while
// signed in as the customer that actually owns the row.
//
// No passwords are changed and nothing is written to the database.
//
// Usage: node tests/qa/discover-storefront-detail.mjs
import "./load-env.mjs";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing");

const rest = (path, init = {}) =>
  fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

async function json(path, init) {
  const res = await rest(path, init);
  const text = await res.text();
  if (!res.ok) throw new Error(`${init?.method ?? "GET"} ${path} -> ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

// GoTrue endpoints live outside PostgREST, so they need their own base URL.
async function authJson(path, body) {
  const res = await fetch(`${url}/auth/v1/${path}`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`POST auth/v1/${path} -> ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

// auth.users is not exposed through PostgREST, so resolve emails via GoTrue.
async function emailsFor(ids) {
  const wanted = new Set(ids);
  const found = {};
  for (let page = 1; page <= 10; page += 1) {
    const res = await fetch(`${url}/auth/v1/admin/users?page=${page}&per_page=200`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    if (!res.ok) throw new Error(`GET auth/v1/admin/users -> ${res.status} ${await res.text()}`);
    const body = await res.json();
    const users = body.users ?? body;
    for (const user of users) {
      if (wanted.has(user.id)) found[user.id] = user.email;
    }
    if (users.length < 200) break;
  }
  return found;
}

const orders = await json("orders?select=id,order_number,user_id,status,created_at&order=created_at.desc&limit=3");
const notifications = await json(
  "notifications?select=id,user_id,title,created_at&order=created_at.desc&limit=3",
);

console.log("orders:");
for (const o of orders ?? []) console.log("  ", JSON.stringify(o));
console.log("notifications:");
for (const n of notifications ?? []) console.log("  ", JSON.stringify(n));

const ownerIds = [...new Set([...(orders ?? []).map((o) => o.user_id), ...(notifications ?? []).map((n) => n.user_id)])].filter(Boolean);
if (ownerIds.length === 0) {
  console.log("\nno order/notification owners found");
  process.exit(0);
}

const emails = await emailsFor(ownerIds);
for (const [id, email] of Object.entries(emails)) {
  const link = await authJson("admin/generate_link", { type: "magiclink", email });
  // GoTrue returns hashed_token at the top level on current versions and
  // under `properties` on older ones.
  const tokenHash = link?.hashed_token ?? link?.properties?.hashed_token;
  if (!tokenHash) {
    console.log(`could not mint a session for user ${id}`);
    continue;
  }
  const session = await authJson("verify", { type: "magiclink", token_hash: tokenHash });
  console.log(`\nuser ${id} <${session?.user?.email ?? email}>`);
  console.log(`  orders: ${(orders ?? []).filter((o) => o.user_id === id).map((o) => `${o.order_number} ${o.id}`).join(" | ") || "none"}`);
  console.log(`  notifications: ${(notifications ?? []).filter((n) => n.user_id === id).map((n) => `${n.title} ${n.id}`).join(" | ") || "none"}`);
  console.log(`  session access token length: ${session?.access_token?.length ?? 0}`);
}

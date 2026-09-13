/**
 * Shared QA harness — Phase 0 safety layer.
 *
 * GUARANTEE: every mutating QA test uses ONLY disposable resources created by
 * this harness and cleans them up afterwards. Real catalog items, customer
 * accounts and orders are never edited, deleted, or re-priced. Read-only
 * queries may touch real data, but mutations never do.
 *
 * Disposable products are named with an unmistakable "QA TEMP" prefix and a
 * unique token; disposable customers use a per-run email. Cleanup is order-safe
 * against the production schema:
 *   - orders.user_id        → ON DELETE RESTRICT   (orders must be deleted first)
 *   - order_items.product_id → ON DELETE SET NULL  (order deletion cascades)
 *   - cart_items/wishlist/product, profiles, ai_conversations, notifications
 *                            → cascade off auth.users / products
 *
 * All service-role calls pin a `User-Agent: node` header because Supabase
 * rejects secret API keys when they appear to come from a browser.
 */
import "../load-env.mjs";

const env = process.env;

export const SUPABASE_URL = env.SUPABASE_URL;
export const SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY;
export const SUPABASE_SERVICE_KEY = env.SUPABASE_SERVICE_KEY;
export const APP_URL = env.APP_URL;

export function projectRef() {
  const m = (SUPABASE_URL || "").match(/https:\/\/([^.]+)\.supabase\.co/);
  return m ? m[1] : "geturxcylpsubnzweilc";
}

function serviceHeaders(json) {
  const h = {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    "User-Agent": "node",
  };
  if (json) h["Content-Type"] = "application/json";
  return h;
}

export async function serviceGet(path) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    method: "GET",
    headers: serviceHeaders(),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`serviceGet ${path} -> ${res.status}: ${body}`);
  }
  return res.json();
}

export async function servicePost(path, body) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    method: "POST",
    headers: serviceHeaders(true),
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}

export async function servicePatch(path, body) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    method: "PATCH",
    headers: { ...serviceHeaders(true), Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`servicePatch ${path} -> ${res.status}: ${text}`);
  }
  return res.json();
}

export async function serviceDelete(path) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    method: "DELETE",
    headers: serviceHeaders(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`serviceDelete ${path} -> ${res.status}: ${text}`);
  }
  return res.status;
}

// ── Auth ────────────────────────────────────────────────────────────────────

export async function signIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ email, password }),
  });
  return res.json();
}

export function sessionCookie(auth) {
  const session = {
    access_token: auth.access_token,
    refresh_token: auth.refresh_token,
    expires_in: auth.expires_in,
    expires_at: auth.expires_at,
    token_type: "bearer",
    user: auth.user,
  };
  return `sb-${projectRef()}-auth-token=${encodeURIComponent(JSON.stringify(session))}`;
}

// ── Disposable resources (Phase 0 core) ────────────────────────────────────

export function uniqueToken() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function disposableProductName(token, hint = "") {
  return `QA TEMP ${hint ? hint + " " : ""}${token}`;
}

export function disposableSlug(token, hint = "") {
  return `qa-temp-${hint ? hint + "-" : ""}${token}`.toLowerCase();
}

/**
 * Create a disposable product directly in the DB (test setup only — this is a
 * uniquely-named resource, never an edit to an existing catalog item).
 */
export async function createDisposableProduct({
  token,
  hint = "",
  name,
  slug,
  categoryId,
  price = 1234,
  stock = 5,
  lowStockThreshold = 4,
  description = "QA TEMP disposable product. Safe to delete.",
  active = true,
} = {}) {
  const t = token ?? uniqueToken();
  const body = {
    name: name ?? disposableProductName(t, hint),
    slug: slug ?? disposableSlug(t, hint),
    sku: `QAT-${t}`,
    price,
    stock_quantity: stock,
    low_stock_threshold: lowStockThreshold,
    description,
    is_active: active,
    is_featured: false,
    sort_order: 0,
  };
  if (categoryId) body.category_id = categoryId;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/products`, {
    method: "POST",
    headers: { ...serviceHeaders(true), Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`createDisposableProduct -> ${res.status}: ${text}`);
  }
  const rows = await res.json();
  return (Array.isArray(rows) ? rows[0] : rows) ?? null;
}

/** Hard-delete a product. Cascades cart_items/wishlist_items; order_items get NULLed. */
export async function deleteDisposableProduct(productId) {
  return serviceDelete(`/rest/v1/products?id=eq.${productId}`);
}

/**
 * Create a fresh disposable customer (auth user + auto profile + name patch).
 * Returns { auth, cookie, userId, email, fullName, token }.
 */
export async function createDisposableCustomer({ token, fullName } = {}) {
  const t = token ?? uniqueToken();
  const email = `qa.${t}@dins.test`;
  const password = "QaPass!1234";
  const name = fullName ?? `QA TEMP CUST ${t}`;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: serviceHeaders(true),
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name },
    }),
  });
  const created = await res.json();
  if (!created.id) {
    throw new Error(`createDisposableCustomer -> ${res.status}: ${JSON.stringify(created)}`);
  }
  await servicePatch(`/rest/v1/profiles?id=eq.${created.id}`, {
    full_name: name,
    city: "Karachi",
    phone: "03001234567",
  }).catch(() => {});
  const auth = await signIn(email, password);
  if (!auth.access_token) {
    throw new Error(`createDisposableCustomer sign-in failed: ${JSON.stringify(auth)}`);
  }
  return {
    auth,
    cookie: sessionCookie(auth),
    userId: created.id,
    email,
    fullName: name,
    token: t,
  };
}

/** Delete every order owned by userId (orders must go before the user due to RESTRICT). */
export async function deleteOrdersByUser(userId) {
  const orders = await serviceGet(
    `/rest/v1/orders?select=id&user_id=eq.${userId}`,
  ).catch(() => []);
  for (const o of Array.isArray(orders) ? orders : []) {
    await serviceDelete(`/rest/v1/orders?id=eq.${o.id}`).catch(() => {});
  }
}

/** Hard-delete a customer and everything they own (orders must already be gone). */
export async function deleteDisposableCustomer(userId) {
  await deleteOrdersByUser(userId);
  const res = await fetch(
    `${SUPABASE_URL}/auth/v1/admin/users/${userId}`,
    { method: "DELETE", headers: serviceHeaders() },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`deleteDisposableCustomer -> ${res.status}: ${text}`);
  }
}

/**
 * Create a disposable COD order owned by `customerId` for `productId` directly.
 * Used only for admin order-status tests. Returns the created order row.
 */
export async function createDisposableOrder({ customerId, productId, productName, productPrice, quantity = 1, customerName, customerEmail }) {
  const token = uniqueToken();
  const orderNumber = `DIN-${new Date()
    .toISOString()
    .replace(/[-T:.Z]/g, "")
    .slice(0, 16)}-${token.slice(-4)}`;
  const lineSubtotal = productPrice * quantity;
  const shippingFee = 200;
  const total = lineSubtotal + shippingFee;
  const orderRes = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
    method: "POST",
    headers: { ...serviceHeaders(true), Prefer: "return=representation" },
    body: JSON.stringify({
      user_id: customerId,
      order_number: orderNumber,
      status: "pending",
      payment_status: "pending",
      payment_method: "cod",
      customer_name: customerName ?? "QA Disposable Customer",
      customer_phone: "03001234567",
      customer_email: customerEmail ?? "qa@dins.test",
      shipping_address: "QA TEMP Address 123",
      city: "Karachi",
      postal_code: "74000",
      subtotal: lineSubtotal,
      shipping_fee: shippingFee,
      total,
      order_notes: "QA TEMP disposable order",
    }),
  });
  if (!orderRes.ok) {
    const text = await orderRes.text().catch(() => "");
    throw new Error(`createDisposableOrder order -> ${orderRes.status}: ${text}`);
  }
  const orderRows = await orderRes.json();
  const order = Array.isArray(orderRows) ? orderRows[0] : orderRows;

  const itemRes = await fetch(`${SUPABASE_URL}/rest/v1/order_items`, {
    method: "POST",
    headers: { ...serviceHeaders(true), Prefer: "return=representation" },
    body: JSON.stringify({
      order_id: order.id,
      product_id: productId,
      product_name: productName,
      product_price: productPrice,
      quantity,
      subtotal: lineSubtotal,
    }),
  });
  if (!itemRes.ok) {
    await serviceDelete(`/rest/v1/orders?id=eq.${order.id}`);
    const text = await itemRes.text().catch(() => "");
    throw new Error(`createDisposableOrder item -> ${itemRes.status}: ${text}`);
  }
  return order;
}

export async function getFirst(table, filter = "") {
  const rows = await serviceGet(
    `/rest/v1/${table}?select=*${filter ? "&" + filter : ""}&limit=1`,
  );
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

export async function queryRows(table, filter = "", extra = "") {
  const q = [
    `/rest/v1/${table}?select=*`,
    filter ? `&${filter}` : "",
    extra ? `&${extra}` : "",
  ].join("");
  return serviceGet(q);
}

// ── Chat helpers (NDJSON) ──────────────────────────────────────────────────

/**
 * Send one chat message to a channel. Returns:
 * { status, text, tools, toolEvents, agents, conversationId, meta, raw }
 */
export async function chat(channel, { message, conversationId, history }, cookie) {
  const body = { message };
  if (conversationId) body.conversationId = conversationId;
  if (Array.isArray(history) && history.length) body.history = history;

  const headers = { "Content-Type": "application/json" };
  if (cookie) headers.Cookie = cookie;

  const res = await fetch(`${APP_URL}/api/ai/${channel}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const raw = await res.text();

  if (res.status !== 200) {
    let data = {};
    try { data = JSON.parse(raw); } catch {}
    return {
      status: res.status,
      error: data.error ?? res.statusText,
      text: "",
      tools: [],
      toolEvents: [],
      agents: [],
      conversationId: conversationId ?? null,
      meta: {},
      raw,
    };
  }

  let text = "";
  let conversationIdFromMeta = conversationId ?? null;
  const tools = [];
  const toolEvents = [];
  const agents = [];
  let meta = {};
  const doneOutput = { text: "", error: null };

  for (const line of raw.trim().split("\n")) {
    let ev;
    try { ev = JSON.parse(line); } catch { continue; }
    if (ev.type === "text") text += ev.delta ?? "";
    if (ev.type === "done") doneOutput.text = ev.output ?? "";
    if (ev.type === "agent") agents.push(ev.name);
    if (ev.type === "meta") {
      meta = ev;
      if (ev.conversationId) conversationIdFromMeta = ev.conversationId;
    }
    if (ev.type === "tool") {
      toolEvents.push(ev);
      if (ev.state === "end") tools.push(ev.name);
    }
  }

  return {
    status: res.status,
    text: text.trim(),
    tools,
    toolEvents,
    agents,
    conversationId: conversationIdFromMeta,
    meta,
    doneOutput,
    raw,
  };
}

export const chatAdmin = (cookie, message, opts = {}) =>
  chat("admin", { message, ...opts }, cookie);

export const chatSalesman = (cookie, message, opts = {}) =>
  chat("salesman", { message, ...opts }, cookie);

// ── Audit evidence ─────────────────────────────────────────────────────────

export async function recentAuditLogs(limit = 60) {
  const rows = await serviceGet(
    `/rest/v1/ai_audit_logs?select=id,user_id,actor_role,agent_name,tool_name,action_type,risk,status,entity_type,entity_id,detail,created_at&order=created_at.desc&limit=${limit}`,
  ).catch(() => []);
  return Array.isArray(rows) ? rows : [];
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Result recording ───────────────────────────────────────────────────────

export class QaResults {
  constructor() {
    this.results = [];
  }

  record(id, scenario, pass, details = {}) {
    this.results.push({ id, scenario, pass, ...details });
    const icon = pass ? "PASS" : "FAIL";
    console.log(`[${pass ? "✓" : "✗"}] ${id}: ${scenario} — ${icon}`);
    if (details.note) console.log(`    Note: ${details.note}`);
    if (details.mismatch) console.log(`    MISMATCH: ${details.mismatch}`);
    if (details.tools?.length) console.log(`    Tools: ${details.tools.join(", ")}`);
    if (details.evidence != null) console.log(`    Evidence: ${details.evidence}`);
  }

  summary(title) {
    let pass = 0;
    let fail = 0;
    console.log(`\n===== ${title} =====`);
    for (const r of this.results) {
      console.log(`  ${r.pass ? "✓" : "✗"} ${r.id}. ${r.scenario} — ${r.pass ? "PASS" : "FAIL"}`);
      if (r.mismatch) console.log(`      mismatch: ${r.mismatch}`);
      pass += r.pass ? 1 : 0;
      fail += r.pass ? 0 : 1;
    }
    console.log(`  Total: ${this.results.length} | PASS: ${pass} | FAIL: ${fail}\n`);
    return { total: this.results.length, pass, fail };
  }

  onlyFailures() {
    return this.results.filter((r) => !r.pass);
  }
}

/** Best-effort snapshot of what the user asked and which tools fired. */
export function summarize(res) {
  return {
    tools: res.tools,
    agents: res.agents,
    textLength: res.text.length,
    snippet: res.text.slice(0, 160),
  };
}
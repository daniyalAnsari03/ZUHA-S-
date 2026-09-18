/**
 * DOCS/FIX.TXT QUADRANT REGRESSION — items 1–4.
 *
 * Locks in the four behavioural fixes from docs/fix.txt so they cannot
 * silently reappear:
 *
 *   1. NUMBER TRUTHFULNESS — the AI must never state a product count unless it
 *      comes from a real tool result THIS turn (list_products now returns a
 *      real totalCount). Asking "how many active products?" must produce the
 *      real DB total — never an invented "25" / "N missing" figure.
 *   2. SINGLE DELETE EXECUTES DIRECTLY — delete_product has no confirm gate;
 *      one clear request deletes the product in the SAME turn, no question asked.
 *   3. SHORT VERB-ONLY FOLLOW-UP → CURRENT FOCUS — a terse continuation
 *      ("delete kar do") after naming product B must delete B (the current
 *      focus), NEVER product A that was named earlier in the same conversation.
 *   4. POPULARITY COMES FROM SALES DATA — "sabse hit konsa hai" must fire
 *      get_sales_overview, never a stock/inventory answer.
 *
 * All mutations touch only disposable QA TEMP products created here and
 * deleted at teardown.
 *
 * Requires: dev server on APP_URL, .env.test with admin credentials.
 *
 * Usage: node tests/qa/docs-fix-four-qa.mjs
 */
import {
  chatAdmin,
  createDisposableProduct,
  deleteDisposableProduct,
  projectRef,
  QaResults,
  recentAuditLogs,
  serviceGet,
  signIn,
  sleep,
  uniqueToken,
} from "./lib/harness.mjs";

const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  throw new Error("ADMIN_EMAIL/ADMIN_PASSWORD missing from .env.test");
}

const results = new QaResults();

const auth = await signIn(ADMIN_EMAIL, ADMIN_PASSWORD);
if (!auth.access_token) throw new Error("Admin login failed");
const adminCookie =
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

function hasTool(res, names) {
  return (res.tools || []).some((t) => names.includes(t));
}

const INT_RE = /\d{1,7}/g;
function integersOf(text) {
  return [...(text.match(INT_RE) ?? [])].map(Number);
}

async function realActiveProductCount() {
  const rows = await serviceGet(
    `/rest/v1/products?select=id&is_active=eq.true`,
  ).catch(() => []);
  return Array.isArray(rows) ? rows.length : 0;
}

async function realTopSellingProduct() {
  const orders = await serviceGet(
    `/rest/v1/orders?select=id,status,payment_status`,
  ).catch(() => []);
  const items = await serviceGet(
    `/rest/v1/order_items?select=product_name,product_id,quantity,subtotal,order_id`,
  ).catch(() => []);

  if (!Array.isArray(orders) || !Array.isArray(items)) return null;

  const excluded = (status, payment) =>
    status === "cancelled" ||
    payment === "failed" ||
    payment === "refunded";

  const orderById = new Map(
    orders.map((o) => [
      o.id,
      { status: o.status, payment_status: o.payment_status },
    ]),
  );
  const agg = new Map();
  for (const it of items) {
    const order = orderById.get(it.order_id);
    if (!order || excluded(order.status, order.payment_status)) continue;
    const key = it.product_id ?? it.product_name;
    const row = agg.get(key) ?? { name: it.product_name, units: 0, revenue: 0 };
    row.units += Number(it.quantity ?? 0);
    row.revenue += Number(it.subtotal ?? 0);
    agg.set(key, row);
  }
  const ranked = [...agg.values()].sort((a, b) => b.revenue - a.revenue);
  return ranked.length ? ranked[0] : null;
}

async function rowExists(productId) {
  const rows = await serviceGet(
    `/rest/v1/products?id=eq.${productId}&select=id`,
  ).catch(() => []);
  return Array.isArray(rows) && rows.length > 0;
}

const log = [];
function logExchange(label, message, res) {
  log.push({ label, message, tools: res.tools || [], response: res.text });
  console.log(`\n── ${label} ──`);
  console.log(`  MESSAGE: ${JSON.stringify(message)}`);
  console.log(`  TOOLS: [${(res.tools || []).join(", ")}]`);
  console.log(`  RESPONSE: ${JSON.stringify(res.text)}`);
}

// ── Setup: disposable products (item 2 → X; item 3 → A must survive, B dies) ─
const targetX = await createDisposableProduct({ token: uniqueToken(), hint: "FIXX", stock: 7 });
const targetA = await createDisposableProduct({ token: uniqueToken(), hint: "FIXA", stock: 8 });
const targetB = await createDisposableProduct({ token: uniqueToken(), hint: "FIXB", stock: 9 });
console.log(
  "[setup] disposable products:",
  `X="${targetX.name}"`,
  `A="${targetA.name}"`,
  `B="${targetB.name}"`,
);

try {
  // ── ITEM 1: no invented count; the reply must reflect the REAL total ──
  const realTotal = await realActiveProductCount();
  const msg1 = "catalog mein kitne active products hain total?";
  const r1 = await chatAdmin(adminCookie, msg1);
  logExchange("Item 1 (product count truthfulness)", msg1, r1);
  const f1Integers = integersOf(r1.text);
  const f1ToolOk = hasTool(r1, ["list_products", "search_products_admin"]);
  const f1MatchesReal = f1Integers.includes(realTotal);
  results.record(
    "FF1",
    "item 1: stated product count matches the REAL database total (no invented figure)",
    f1ToolOk && f1MatchesReal && realTotal > 0,
    {
      tools: r1.tools,
      evidence: `dbActive=${realTotal}, integersInReply=[${f1Integers.join(",")}]`,
      note: r1.text.slice(0, 240),
      mismatch: !f1ToolOk
        ? `no catalog tool fired; got ${r1.tools.join(", ")}`
        : realTotal === 0
          ? "catalog is empty — cannot validate count truthfulness"
          : !f1MatchesReal
            ? `reply has no integer equal to the real total ${realTotal}: "${r1.text.slice(0, 240)}"`
            : null,
    },
  );

  // ── ITEM 2: single delete executes directly (no confirmation gate) ──
  await sleep(500);
  const msg2 = `"${targetX.name}" product ko delete kar do`;
  const r2 = await chatAdmin(adminCookie, msg2);
  logExchange("Item 2 (direct single delete)", msg2, r2);
  await sleep(300);
  const xGone = !(await rowExists(targetX.id));
  const f2AskedConfirm =
    /\?/.test(r2.text) &&
    /(confirm|kar doon|pakka|sure|delete|proceed)/i.test(r2.text);
  const f2DeleteFired = hasTool(r2, ["delete_product"]);
  results.record(
    "FF2",
    "item 2: single product delete executed directly — deletion succeeded and no confirmation was asked",
    f2DeleteFired && xGone && !f2AskedConfirm,
    {
      tools: r2.tools,
      evidence: `deleteTool=${f2DeleteFired}, productGone=${xGone}, askedConfirm=${f2AskedConfirm}`,
      note: r2.text.slice(0, 200),
      mismatch: !f2DeleteFired
        ? `no delete_product tool; got ${r2.tools.join(", ")}`
        : !xGone
          ? "product still in DB after the AI claimed deletion"
          : f2AskedConfirm
            ? "AI asked for confirmation on a single-product delete"
            : null,
    },
  );

  // ── ITEM 3: short verb-only follow-up resolves to CURRENT focus (B), not
  // ── the earlier-mentioned product A.
  await sleep(500);
  const r3a = await chatAdmin(
    adminCookie,
    `product "${targetB.name}" ka complete detail batao`,
  );
  const conv = r3a.conversationId;
  logExchange(
    "Item 3 turn1 (name B → focus B)",
    `product "${targetB.name}" ka complete detail batao`,
    r3a,
  );
  await sleep(400);
  const msg3b = "delete kar do";
  const r3b = await chatAdmin(adminCookie, msg3b, { conversationId: conv });
  logExchange("Item 3 turn2 (short delete continuation)", msg3b, r3b);
  await sleep(300);
  const bGone = !(await rowExists(targetB.id));
  const aUnscathed = await rowExists(targetA.id);

  const audit = (await recentAuditLogs(40).catch(() => [])) || [];
  const deleteAudits = audit.filter((l) => l.tool_name === "delete_product");
  const aEverDeleted = deleteAudits.some((l) => l.entity_id === targetA.id);
  const bDeleted = deleteAudits.some((l) => l.entity_id === targetB.id);

  results.record(
    "FF3",
    "item 3: short 'delete kar do' follow-up hit the CURRENT focus (B), never the earlier-discussed product (A)",
    bGone && aUnscathed && bDeleted && !aEverDeleted,
    {
      tools: r3b.tools,
      evidence: `deleteAuditTargets=[${deleteAudits.map((l) => l.entity_id).join(",") || "none"}], bGone=${bGone}, aUnscathed=${aUnscathed}, aEverDeleted=${aEverDeleted}`,
      note: r3b.text.slice(0, 200),
      mismatch: aEverDeleted
        ? `WRONG TARGET: delete_product fired on the earlier-discussed product A (${targetA.id})`
        : !bGone
          ? "focused product B was not deleted by the short follow-up"
          : !bDeleted
            ? "no delete_product audit found for focused product B"
            : !aUnscathed
              ? "earlier-discussed product A is gone from the DB"
              : null,
    },
  );

  // ── ITEM 4: popularity must come from sales analytics, not stock ──
  await sleep(500);
  const msg4 = "sabse hit product konsa hai?";
  const r4 = await chatAdmin(adminCookie, msg4);
  logExchange("Item 4 (popularity from sales data)", msg4, r4);
  const f4SalesTool = hasTool(r4, ["get_sales_overview"]);
  const f4InventoryBogus = hasTool(r4, [
    "list_low_stock_products",
    "update_stock",
    "search_products_admin",
  ]);
  const stockProxyPhrase =
    /(only|sirf|kam) .{0,20}(left|stock|reh|gya|giay)|low stock/i.test(
      r4.text,
    );
  const realTop = await realTopSellingProduct();
  const f4MentionsRealTop =
    realTop && realTop.name
      ? r4.text.toLowerCase().includes(realTop.name.slice(0, 8).toLowerCase())
      : true;
  const f4NoSalesData =
    /(no sales|no order|koi sales nahi|no data|not yet|abhi tak)/i.test(
      r4.text,
    );
  const f4Valid = realTop ? f4MentionsRealTop : f4NoSalesData;

  results.record(
    "FF4",
    "item 4: 'sabse hit' answered ONLY from get_sales_overview (never from stock level)",
    f4SalesTool && !f4InventoryBogus && !stockProxyPhrase && f4Valid,
    {
      tools: r4.tools,
      evidence: `salesTool=${f4SalesTool}, stockTools=${f4InventoryBogus}, stockProxyPhrase=${stockProxyPhrase}, topProduct=${realTop?.name ?? "none"}, mentionsTop=${f4MentionsRealTop}, noSalesPhrase=${f4NoSalesData}`,
      note: r4.text.slice(0, 240),
      mismatch: !f4SalesTool
        ? `get_sales_overview did not fire; got ${r4.tools.join(", ")}`
        : f4InventoryBogus
          ? `inventory/stock tool fired for a popularity question: ${f4InventoryBogus.join(", ")}`
          : stockProxyPhrase
            ? "reply justifies popularity from stock level"
            : realTop && !f4MentionsRealTop
              ? `reply does not name the real top seller ("${realTop.name}")`
              : !realTop && !f4NoSalesData
                ? "no sales data exists but reply neither says so nor names a product"
                : null,
    },
  );
} finally {
  console.log("\n[cleanup] deleting disposable products…");
  for (const id of [targetX.id, targetA.id, targetB.id]) {
    await deleteDisposableProduct(id).catch(() => {});
  }
}

console.log("\n═══ EXACT MESSAGES + RESPONSES (items 1–4) ═══");
for (const entry of log) {
  console.log(`\n[${entry.label}]`);
  console.log(`  Message used: ${entry.message}`);
  console.log(`  Response received: ${entry.response}`);
  console.log(`  Tools fired: [${entry.tools.join(", ")}]`);
}

const summary = results.summary("DOCS/FIX.TXT QUADRANT (items 1–4)");
process.exitCode = summary.fail > 0 ? 1 : 0;
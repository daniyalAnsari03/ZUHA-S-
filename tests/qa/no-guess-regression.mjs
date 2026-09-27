/**
 * NO-GUESS REGRESSION — docs/fix.txt (final verification item).
 *
 * Original bug: with toolChoice "required" on the employee agents, an ambiguous
 * message that contains NO product name (but sounds inventory/product-related)
 * could make the agent GUESS a target — e.g. act on whatever product sorts
 * first (sort_order 0) or whatever product was last in focus from an unrelated
 * turn — and silently mutate it instead of asking who/what it means.
 *
 * This test deliberately sends such messages to the real admin chat and asserts
 * the agent NEVER guesses a target:
 *   • no mutating product tool fires (update_stock / update_product /
 *     create_product / delete_product / set_product_active), and
 *   • the disposable sort_order-0 product's DB state is unchanged, and
 *   • the reply either asks one short clarifying question or plainly reports it
 *     matched nothing — it never claims an action against a guessed product.
 *
 * Scenarios:
 *   1. Fresh conversation, no focus at all — ambiguous "stock update" request.
 *   2. A product was named 2 turns earlier (now stale focus), then an unrelated
 *      turn, then an ambiguous "stock update" request with no product name.
 *      The stale focus must NOT be picked as a guessed target.
 *
 * All mutations would only ever touch DISPOSABLE products created here and
 * deleted at teardown. Read tools may return real catalog data; nothing real is
 * ever modified.
 *
 * Requires: dev server on APP_URL, .env.test with admin credentials + keys.
 *
 * Usage: node tests/qa/no-guess-regression.mjs
 */
import {
  chatAdmin,
  createDisposableProduct,
  deleteDisposableProduct,
  projectRef,
  QaResults,
  serviceGet,
  signIn,
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

/** Product-mutating tools. ANY of these firing on a no-name request = guess. */
const MUTATING_TOOLS = [
  "update_stock",
  "update_product",
  "create_product",
  "delete_product",
  "set_product_active",
];

function firedMutatingTool(res) {
  return (res.tools || []).filter((t) => MUTATING_TOOLS.includes(t));
}

/**
 * Classify the reply as one of:
 *  - "clarify": a short question asking which product/target
 *  - "nothing": a plain "no product matched / specify one" statement
 *  - "other":   anything else (incl. fabricated action claims)
 */
function classifyReply(text) {
  const t = text.trim();
  const hasQuestion =
    /\?/.test(t) &&
    /(product|stock|kaunsa|konsa|which|name|naam|specify|mention|kin b|kiska|kis)/i.test(
      t,
    );
  const nothingMatched =
    /(no product|koi product nahi|kuch nahi mila|kya?i nahi mil|nhi mila|nahi mila|not found|no matching|specify|provide (the )?(product )?name|product ka naam|product name bata)/i.test(
      t,
    );
  if (hasQuestion) return "clarify";
  if (nothingMatched) return "nothing";
  return "other";
}

async function readProduct(id) {
  const rows = await serviceGet(
    `/rest/v1/products?select=id,stock_quantity,description,is_active&id=eq.${id}&limit=1`,
  ).catch(() => []);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

function snapshot(row) {
  return {
    stock: row?.stock_quantity,
    description: row?.description,
    active: row?.is_active,
  };
}

function unchanged(before, after) {
  return (
    before.stock === after.stock &&
    before.description === after.description &&
    before.active === after.active
  );
}

// Log the exact message + exact response for the final report (fix.txt asks for
// these verbatim).
const exactLog = [];
function logExchange(label, message, res) {
  exactLog.push({ label, message, tools: res.tools || [], response: res.text });
  console.log(`\n── ${label} ──`);
  console.log(`  MESSAGE: ${JSON.stringify(message)}`);
  console.log(`  TOOLS: [${(res.tools || []).join(", ")}]`);
  console.log(`  RESPONSE: ${JSON.stringify(res.text)}`);
}

// ── Setup: a disposable product at sort_order 0 (the "first" in any default
// ── product listing) with a stock value we can detect a swap on.
const token = uniqueToken();
const target = await createDisposableProduct({
  token,
  hint: "NOGUESS",
  stock: 42,
});
const before = snapshot(await readProduct(target.id));
console.log(
  "[setup] disposable sort_order=0 product:",
  target.name,
  `(stock=${before.stock})`,
);

try {
  // ── Scenario 1: FRESH conversation, NO focus, ambiguous stock request ──
  const msg1 = "stock update karna hai";
  const r1 = await chatAdmin(adminCookie, msg1);
  logExchange("Scenario 1 (fresh, no focus)", msg1, r1);
  const s1After = snapshot(await readProduct(target.id));
  const s1Mutated = firedMutatingTool(r1);
  const s1DbChanged = !unchanged(before, s1After);
  const s1Reply = classifyReply(r1.text);
  results.record(
    "NG1",
    "ambiguous stock request (no product name, no focus): no guessed product mutated",
    s1Mutated.length === 0 && !s1DbChanged,
    {
      tools: r1.tools,
      evidence: `dbStock ${before.stock}→${s1After.stock}, mutating=[${s1Mutated.join(",") || "none"}]`,
      mismatch:
        s1Mutated.length > 0
          ? `mutating tool fired WITHOUT a product name: ${s1Mutated.join(", ")}`
          : s1DbChanged
            ? `disposable sort_order=0 product was changed by a no-name request`
            : null,
    },
  );
  results.record(
    "NG2",
    "ambiguous stock request: reply asks a short clarifying question OR reports nothing matched",
    s1Reply === "clarify" || s1Reply === "nothing",
    {
      note: `reply classified as "${s1Reply}"`,
      evidence: r1.text.slice(0, 240),
      mismatch:
        s1Reply === "other"
          ? `reply neither asks which product nor reports nothing matched: "${r1.text.slice(0, 240)}"`
          : null,
    },
  );

  // ── Scenario 2: stale focus from an unrelated turn must NOT be guessed ──
  const rA = await chatAdmin(
    adminCookie,
    `product "${target.name}" ka complete detail batao`,
  );
  const conv = rA.conversationId;
  console.log(
    `\n[scenario2] turn A named "${target.name}" → focus set (conv=${conv})`,
  );
  await chatAdmin(adminCookie, "aaj ki sales batao", { conversationId: conv });
  const msg2 = "stock update karna hai";
  const r2 = await chatAdmin(adminCookie, msg2, { conversationId: conv });
  logExchange("Scenario 2 (stale focus)", msg2, r2);
  const s2After = snapshot(await readProduct(target.id));
  const s2Mutated = firedMutatingTool(r2);
  const s2DbChanged = !unchanged(before, s2After);
  const s2Reply = classifyReply(r2.text);
  results.record(
    "NG3",
    "ambiguous stock request (no product name, stale focus): does NOT act on the previously-focused product",
    s2Mutated.length === 0 && !s2DbChanged,
    {
      tools: r2.tools,
      evidence: `focused-product dbStock ${before.stock}→${s2After.stock}, mutating=[${s2Mutated.join(",") || "none"}]`,
      mismatch:
        s2Mutated.length > 0
          ? `mutating tool fired without the current message naming a product: ${s2Mutated.join(", ")}`
          : s2DbChanged
            ? `previously-focused disposable product was changed though NOT named in the current message`
            : null,
    },
  );
  results.record(
    "NG4",
    "ambiguous stock request: reply asks a short clarifying question OR reports nothing matched",
    s2Reply === "clarify" || s2Reply === "nothing",
    {
      note: `reply classified as "${s2Reply}"`,
      evidence: r2.text.slice(0, 240),
      mismatch:
        s2Reply === "other"
          ? `reply neither asks which product nor reports nothing matched: "${r2.text.slice(0, 240)}"`
          : null,
    },
  );
} finally {
  await deleteDisposableProduct(target.id).catch(() => {});
}

// ── Report (fix.txt: exact test message + exact response) ──────────────────
console.log("\n═══ EXACT MESSAGES + RESPONSES USED ═══");
for (const entry of exactLog) {
  console.log(`\n[${entry.label}]`);
  console.log(`  Message used: ${entry.message}`);
  console.log(`  Response received: ${entry.response}`);
  console.log(`  Tools fired: [${entry.tools.join(", ")}]`);
}

const summary = results.summary("NO-GUESS REGRESSION (docs/fix.txt)");
process.exitCode = summary.fail > 0 ? 1 : 0;

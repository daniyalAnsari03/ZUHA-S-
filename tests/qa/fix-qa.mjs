/**
 * docs/fix.txt regression suite (fixes #2–#7).
 *
 * Safety: all mutations run against DISPOSABLE resources created here and
 * deleted at teardown (products created via harness, orders owned by a
 * disposable customer). Real catalog items are never touched — real
 * "Mehrab Jamawar"/"Khirke Jamawar" products must NOT be mutated by these
 * tests, so disposable names carry a unique token and the robot is instructed
 * to operate on the exact `QA FOCUS ...` product it just searched for.
 *
 * Requires: dev server on APP_URL, .env.test with admin credentials + keys.
 */
import {
  QaResults,
  chatAdmin,
  createDisposableCustomer,
  createDisposableOrder,
  createDisposableProduct,
  deleteDisposableCustomer,
  deleteDisposableProduct,
  queryRows,
  serviceGet,
  signIn,
  uniqueToken,
} from "./lib/harness.mjs";

const results = new QaResults();

const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
const auth = await signIn(ADMIN_EMAIL, ADMIN_PASSWORD);
if (!auth.access_token) {
  throw new Error(`Admin sign-in failed: ${JSON.stringify(auth)}`);
}
const adminCookie = `sb-${(process.env.SUPABASE_URL || "").match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || "geturxcylpsubnzweilc"}-auth-token=${encodeURIComponent(JSON.stringify({ access_token: auth.access_token, refresh_token: auth.refresh_token, expires_in: auth.expires_in, expires_at: auth.expires_at, token_type: "bearer", user: auth.user }))}`;

const adminId = auth.user?.id;

async function getCategories() {
  const rows = await serviceGet("/rest/v1/categories?select=id,name&is_active=eq.true&limit=50").catch(() => []);
  return Array.isArray(rows) ? rows : [];
}

async function product(id) {
  const rows = await queryRows("products", `id=eq.${id}`, "select=id,name,slug,description,category_id");
  return Array.isArray(rows) ? rows[0] : null;
}

async function countTextEvents(res) {
  let count = 0;
  let lastTextIndex = -1;
  let doneIndex = -1;
  const lines = res.raw.trim().split("\n");
  lines.forEach((line, i) => {
    try {
      const ev = JSON.parse(line);
      if (ev.type === "text") { count += 1; lastTextIndex = i; }
      if (ev.type === "done") doneIndex = i;
    } catch {}
  });
  return { count, lastTextIndex, doneIndex };
}

// ── Setup ────────────────────────────────────────────────────────────────────
const token = uniqueToken();
const categories = await getCategories();
const categoryName = categories[0]?.name ?? "Jamawar";
const categoryId = categories[0]?.id ?? null;

const mehrab = await createDisposableProduct({
  token,
  hint: `FOCUS MEHRAB`,
  categoryId,
  description: `QA FOCUS original desc ${token}`,
  stock: 7,
  active: true,
});
const khirke = await createDisposableProduct({
  token: `${token}-k`,
  hint: `FOCUS KHIRKE`,
  categoryId,
  description: `QA FOCUS original desc ${token}`,
  stock: 8,
  active: true,
});

const focusCustomer = await createDisposableCustomer({ token });
const disposableOrder = await createDisposableOrder({
  customerId: focusCustomer.userId,
  productId: mehrab.id,
  productName: mehrab.name,
  productPrice: mehrab.price,
  quantity: 1,
});
const orderNumber = disposableOrder.order_number;

try {
  // ── Fix #2: focus/state tracking (Mehrab/Khirke repro) ────────────────────
  const mehrabName = mehrab.name; // "QA TEMP FOCUS MEHRAB <token>"
  const t1 = await chatAdmin(
    adminCookie,
    `product "${mehrabName}" ki description change kar do. Sirf description change karni hai — slug, name, price waghera mat chhedna.`,
  );
  const t2 = await chatAdmin(
    adminCookie,
    "khudhi kar do update desc!",
    { conversationId: t1.conversationId },
  );

  // Authoritative evidence of WHICH product the update targeted: the audit row
  // for update_product in this conversation carries the entity_id.
  const convAudits = (await queryRows(
    "ai_audit_logs",
    `user_id=eq.${adminId}`,
    "select=tool_name,status,entity_type,entity_id,detail,created_at&order=created_at.desc&limit=100",
  ).catch(() => [])).filter(
    (a) => (a.detail?.conversationId ?? null) === t1.conversationId,
  );
  const updateRow = convAudits.find((a) => a.tool_name === "update_product");
  const updateTargetedMehrab = updateRow?.entity_id === mehrab.id;
  const updateTargetedKhirke = updateRow?.entity_id === khirke.id;

  const mehrabAfter = await product(mehrab.id);
  const khirkeAfter = await product(khirke.id);
  const mehrabMutated = !!mehrabAfter && !(mehrabAfter.description ?? "").includes("QA FOCUS original desc");
  const khirkeMutated = !!khirkeAfter && !(khirkeAfter.description ?? "").includes("QA FOCUS original desc");

  const t2CalledUpdate = (t2.tools || []).includes("update_product");

  if (t2CalledUpdate && updateTargetedKhirke) {
    results.record("2a", "#2 focus: ambiguous follow-up mutated WRONG product (regression)", false, {
      mismatch: `update_product targeted Khirke (${khirke.id}) instead of Mehrab (${mehrab.id}).`,
      evidence: `audit entity_id=${updateRow?.entity_id}`,
    });
  } else if (t2CalledUpdate && updateTargetedMehrab && !khirkeMutated) {
    results.record("2a", "#2 focus: ambiguous follow-up resolved to focus entity (Mehrab)", true, {
      note: `update_product targeted Mehrab id ${mehrab.id} (audit); update ${updateRow?.status}; Mehrab desc changed=${mehrabMutated}.`,
      tools: t2.tools,
    });
  } else if (!t2CalledUpdate) {
    const namesMehrab = /mehrab/i.test(t2.text);
    results.record("2a", "#2 focus: no update; reply must still reference the focus product", namesMehrab, {
      note: namesMehrab
        ? "AI asked/clarified naming Mehrab (acceptable per spec)."
        : `AI neither updated nor referenced Mehrab. Snippet: ${t2.text.slice(0, 160)}`,
    });
  } else {
    results.record("2a", "#2 focus: unresolved outcome", false, {
      note: `update row=${JSON.stringify(updateRow)} khirkeMutated=${khirkeMutated}`,
      evidence: t2.text.slice(0, 200),
    });
  }

  // Focus evidence: turn 1 must have recorded the Mehrab product so turn 2's
  // "khudhi karo" could resolve against explicit tracked state.
  const mehrabAudit = convAudits.find(
    (a) => a.entity_type === "product" && a.entity_id === mehrab.id,
  );
  results.record(
    "2b",
    "#2 focus: audit trail recorded the focus product entity",
    !!mehrabAudit,
    { note: mehrabAudit ? `tool=${mehrabAudit.tool_name} status=${mehrabAudit.status}` : "no product entity row found for Mehrab" },
  );

  // ── Fix #3: combined confirm+processing for a PENDING order ────────────────
  const o1 = await chatAdmin(
    adminCookie,
    `order ${orderNumber} ko directly processing kar do.`,
  );
  const afterT1 = (await queryRows("orders", `order_number=eq.${orderNumber}`, "select=status")).find(() => true);
  const offeredCombined =
    /confirm/i.test(o1.text) && /process/i.test(o1.text) && /\?/.test(o1.text);
  results.record(
    "3a",
    "#3 combined: direct pending→processing offered the combined confirm+processing option (no flat refusal)",
    offeredCombined,
    {
      note: afterT1?.status === "pending"
        ? "order still pending after the offer"
        : `order status after offer: ${afterT1?.status}`,
      mismatch: !offeredCombined ? `reply: ${o1.text.slice(0, 200)}` : undefined,
    },
  );

  const o2 = await chatAdmin(
    adminCookie,
    "haan dono kar do.",
    { conversationId: o1.conversationId },
  );
  const afterT2 = (await queryRows("orders", `order_number=eq.${orderNumber}`, "select=status")).find(() => true);
  const usedAdvance = (o2.tools || []).includes("advance_order_status");
  const finalStatus = afterT2?.status;
  results.record(
    "3b",
    "#3 combined: yes executed confirm+processing; order now processing",
    (usedAdvance || (o2.tools || []).includes("update_order_status")) && finalStatus === "processing",
    {
      note: `final=${finalStatus} tools=${(o2.tools || []).join(", ")}`,
      mismatch: finalStatus !== "processing" ? `reply tail: ${o2.text.slice(-160)}` : undefined,
    },
  );

  let historyRows = [];
  try {
    const rows = await queryRows("order_status_history", `order_id=eq.${disposableOrder.id}`, "select=previous_status,new_status&order=created_at.asc");
    historyRows = Array.isArray(rows) ? rows : [];
  } catch {}
  const h = historyRows;
  const hasConfirmed = h.some((r) => r.new_status === "confirmed");
  results.record(
    "3c",
    "#3 combined: order_status_history contains the confirmed step",
    hasConfirmed,
    { note: JSON.stringify(h.map((r) => r.new_status)) },
  );

  // ── Fix #4: AI uses the real PKT date ──────────────────────────────────────
  const expected = new Date().toLocaleDateString("en-GB", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const dayExpected = String(new Date().toLocaleDateString("en-GB", { timeZone: "Asia/Karachi", day: "numeric" }));
  const yearExpected = String(new Date().toLocaleDateString("en-GB", { timeZone: "Asia/Karachi", year: "numeric" }));
  const d = await chatAdmin(adminCookie, "aaj ki complete date kya hai? (sirf sahi date batao)");
  const dateOk = d.text.includes(yearExpected) && (d.text.includes(dayExpected) || d.text.includes(` ${dayExpected} `));
  results.record("4a", "#4 date: reply contains the real PKT date", dateOk, {
    note: `expected(≈${expected}) reply: ${d.text.slice(0, 160)}`,
    mismatch: !dateOk ? `day=${dayExpected} year=${yearExpected}` : undefined,
  });

  // ── Fix #5: get_product includes the linked category name ─────────────────
  const details = await chatAdmin(adminCookie, `product "${mehrab.name}" ki details batao.`);
  const mentionsCategory = new RegExp(categoryName, "i").test(details.text);
  results.record("5a", "#5 category: product details include the real category name", mentionsCategory, {
    note: `category="${categoryName}" in reply: ${mentionsCategory}`,
    mismatch: !mentionsCategory ? `reply: ${details.text.slice(0, 200)}` : undefined,
  });

  // ── Fix #6: Manager answers dashboard overview questions directly ──────────
  const overview = await chatAdmin(adminCookie, "dashboard mein kaun kaun se options hain?");
  const substantive = overview.text.length > 100;
  const mentionsFeature =
    /product/i.test(overview.text) ||
    /order/i.test(overview.text) ||
    /customer/i.test(overview.text) ||
    /setting/i.test(overview.text) ||
    /محصولات|آرڈر|کسٹمر/i.test(overview.text);
  results.record("6a", "#6 overview: Manager answered directly (not a deflection)", substantive && mentionsFeature, {
    note: `level=${overview.text.length}`,
    mismatch: !mentionsFeature ? `reply: ${overview.text.slice(0, 200)}` : undefined,
    tools: overview.tools,
  });

  // ── Fix #7: streaming renders incrementally ────────────────────────────────
  const stream = await chatAdmin(
    adminCookie,
    "Kya aap customers ko delivery/shipping ke baare mein 3 points mein batate ho? detail mein batao.",
  );
  const { count, lastTextIndex, doneIndex } = await countTextEvents(stream);
  results.record("7a", "#7 streaming: multiple incremental text events before done", count >= 2 && lastTextIndex < doneIndex, {
    note: `text events=${count}`,
    mismatch: count < 2 ? "model emitted a single text event (no incremental render)" : undefined,
  });
} finally {
  // ── Teardown (disposable only) ─────────────────────────────────────────────
  await deleteDisposableCustomer(focusCustomer.userId).catch(() => {});
  await deleteDisposableProduct(mehrab.id).catch(() => {});
  await deleteDisposableProduct(khirke.id).catch(() => {});
}

const summary = results.summary(`docs/fix.txt suite (#2-#7), token=${token}`);
process.exitCode = summary.fail > 0 ? 1 : 0;
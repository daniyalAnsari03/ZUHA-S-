/**
 * DRAFT + CONVERSATION-STATE QA — Phase 7 hardening for docs/fix.txt Steps 1–7.
 *
 * Verifies the new per-conversation state architecture end-to-end through the
 * real chat API (NDJSON) against real Supabase data:
 *
 *  A. ADMIN product-create draft survives an unrelated "aaj ki sales batao"
 *     interruption, resumes, completes, creates the real product, and clears
 *     the draft (DB-verified).
 *  B. CUSTOMER checkout draft survives a mid-checkout product question,
 *     resumes to complete collection, places the COD order after ONE
 *     confirmation, and clears the draft (DB-verified).
 *  C. Explicit "chhod do" clears the pending draft server-side.
 *  D. A NEW conversation has ZERO focus — a sales request in a fresh thread
 *     must not bleed "Khirke Jamawar" from another conversation (the STEP 1
 *     leak regression).
 *
 * All mutations use disposable products/customers and are cleaned up.
 *
 * Usage: node tests/qa/draft-conversation-qa.mjs
 */
import {
  chatAdmin,
  chatSalesman,
  createDisposableCustomer,
  createDisposableProduct,
  deleteDisposableCustomer,
  deleteDisposableProduct,
  projectRef,
  QaResults,
  serviceGet,
  signIn,
  sleep,
  uniqueToken,
} from "./lib/harness.mjs";

const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
const results = new QaResults();

const requiredCheckout = ["name", "phone", "email", "shippingAddress", "city"];
const requiredProductCreate = ["name", "price", "stockQuantity"];

let adminCookie = null;
let adminUserId = null;

function slugify(name) {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function ensureAdmin() {
  if (adminCookie) return;
  const auth = await signIn(ADMIN_EMAIL, ADMIN_PASSWORD);
  if (!auth.access_token) {
    throw new Error("Admin login failed");
  }
  adminCookie =
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
  adminUserId = auth.user.id;
  console.log("[auth] admin:", adminUserId);
}

function hasTool(res, names) {
  return res.tools.some((t) => names.includes(t));
}

async function getDraft(userId, conversationId) {
  const rows = await serviceGet(
    `/rest/v1/ai_conversations?select=id,draft&user_id=eq.${userId}&id=eq.${conversationId}`,
  ).catch(() => []);
  const row = Array.isArray(rows) && rows.length ? rows[0] : null;
  return row && row.draft ? row.draft : null;
}

function draftComplete(draft, required) {
  if (!draft) return false;
  return required.every(
    (k) => draft.fields[k] != null && String(draft.fields[k]).trim() !== "",
  );
}

async function findProductBySlug(slug) {
  const rows = await serviceGet(
    `/rest/v1/products?select=id,name,slug,price,stock_quantity&slug=eq.${encodeURIComponent(slug)}`,
  ).catch(() => []);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function pollFor(fn, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = await fn().catch(() => null);
    if (value) return value;
    await sleep(700);
  }
  return null;
}

async function findLatestOrder(userId) {
  const rows = await serviceGet(
    `/rest/v1/orders?select=*&user_id=eq.${userId}&order=created_at.desc&limit=1`,
  ).catch(() => []);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

// ── A. ADMIN product-create draft survives interruption ───────────────────

async function t1_adminProductDraftInterrupt() {
  const token = uniqueToken();
  const productName = `QA TEMP JAMAWAR ${token}`;
  const expectedSlug = slugify(productName);
  let productId = null;

  try {
    const r0 = await chatAdmin(adminCookie, "Ek naya product add karna hai.");
    const conv = r0.conversationId;
    results.record(
      "A1",
      "start product add in a saved admin conversation",
      r0.status === 200 && !!conv,
      { conversationId: conv, tools: r0.tools },
    );

    const r1 = await chatAdmin(
      adminCookie,
      `name "${productName}" price 9000`,
      { conversationId: conv },
    );
    const d1 = await getDraft(adminUserId, conv);
    results.record(
      "A2",
      "draft records name+price and stays open (stock still missing)",
      !!d1 &&
        d1.kind === "product-create" &&
        d1.fields.name === productName &&
        d1.fields.price === 9000 &&
        d1.fields.stockQuantity == null,
      { fields: d1 && d1.fields, tools: r1.tools },
    );

    const r2 = await chatAdmin(adminCookie, "aaj ki sales batao", {
      conversationId: conv,
    });
    const d2 = await getDraft(adminUserId, conv);
    results.record(
      "A3",
      "unrelated sales question is answered AND the product draft survives",
      hasTool(r2, ["get_sales_overview"]) &&
        !!d2 &&
        d2.kind === "product-create" &&
        d2.fields.name === productName,
      { tools: r2.tools, keptName: d2 && d2.fields.name },
    );

    const r3 = await chatAdmin(
      adminCookie,
      "stock 12 kar do, category Embroidery, fabric Jamawar, description 'QA TEMP jamawar premium fabric test'",
      { conversationId: conv },
    );
    const product = await pollFor(() => findProductBySlug(expectedSlug));
    productId = product ? product.id : null;
    const d3 = await getDraft(adminUserId, conv).catch(() => null);
    results.record(
      "A4",
      "draft completes → real product created (price+stock verified) and draft cleared",
      !!product &&
        product.price === 9000 &&
        product.stock_quantity === 12 &&
        d3 === null,
      {
        productSlug: expectedSlug,
        price: product && product.price,
        stock: product && product.stock_quantity,
        draftCleared: d3 === null,
        tools: r3.tools,
      },
    );
  } finally {
    if (productId) await deleteDisposableProduct(productId).catch(() => {});
  }
}

// ── B. CUSTOMER checkout draft survives interruption ───────────────────────

async function t2_customerCheckoutDraftInterrupt() {
  const cust = await createDisposableCustomer({});
  const prod = await createDisposableProduct({});
  const convHolder = { conv: null };

  try {
    const rAdd = await chatSalesman(
      cust.cookie,
      `Ek product apne bag mein add karo: "${prod.name}"`,
    );
    const conv = (convHolder.conv = rAdd.conversationId);
    results.record(
      "B1",
      "customer adds the disposable product to the bag",
      hasTool(rAdd, ["add_to_cart"]) && !!conv,
      { tools: rAdd.tools },
    );

    const rStart = await chatSalesman(
      cust.cookie,
      `Order karna chahti hoon. Mera naam ${cust.fullName} hai.`,
      { conversationId: conv },
    );
    const d1 = await getDraft(cust.userId, conv);
    results.record(
      "B2",
      "checkout draft starts with the customer name",
      !!d1 && d1.kind === "checkout" && d1.fields.name === cust.fullName,
      { fields: d1 && d1.fields, tools: rStart.tools },
    );

    const rInt = await chatSalesman(
      cust.cookie,
      "is product ka fabric kya hai?",
      { conversationId: conv },
    );
    const d2 = await getDraft(cust.userId, conv);
    results.record(
      "B3",
      "mid-checkout product question is answered, checkout draft preserved",
      rInt.status === 200 &&
        !!d2 &&
        d2.kind === "checkout" &&
        d2.fields.name === cust.fullName,
      { keptName: d2 && d2.fields.name, tools: rInt.tools },
    );

    await chatSalesman(cust.cookie, "phone 03001234567, city Lahore", {
      conversationId: conv,
    });
    const rResume = await chatSalesman(
      cust.cookie,
      `address: 123 Model Town Colony, email ${cust.email}`,
      { conversationId: conv },
    );
    const d3 = await getDraft(cust.userId, conv);
    results.record(
      "B4",
      "checkout draft completes full collection (name/phone/email/address/city)",
      draftComplete(d3, requiredCheckout) &&
        d3.fields.city === "Lahore" &&
        d3.fields.email === cust.email &&
        hasTool(rResume, ["save_checkout_draft"]),
      { fields: d3 && d3.fields },
    );

    const rConfirm = await chatSalesman(
      cust.cookie,
      "Haan confirm karte hain. Order place kar do.",
      { conversationId: conv },
    );
    const order = await pollFor(() => findLatestOrder(cust.userId));
    const d4 = await getDraft(cust.userId, conv).catch(() => null);
    results.record(
      "B5",
      "ONE confirmation places the COD order with real details and clears the draft",
      hasTool(rConfirm, ["place_cod_order"]) &&
        !!order &&
        order.city === "Lahore" &&
        order.customer_name === cust.fullName &&
        order.payment_method === "cod" &&
        d4 === null,
      {
        orderNumber: order && order.order_number,
        city: order && order.city,
        payment: order && order.payment_method,
        draftCleared: d4 === null,
        tools: rConfirm.tools,
      },
    );
  } finally {
    await deleteDisposableCustomer(cust.userId).catch(() => {});
    await deleteDisposableProduct(prod.id).catch(() => {});
  }
}

// ── C. Explicit cancel clears the draft ────────────────────────────────────

async function t3_customerExplicitCancel() {
  const cust = await createDisposableCustomer({});
  const prod = await createDisposableProduct({});

  try {
    const rAdd = await chatSalesman(
      cust.cookie,
      `is product ko bag mein add karo: "${prod.name}"`,
    );
    const conv = rAdd.conversationId;
    await chatSalesman(cust.cookie, `Order karna hai. Naam ${cust.fullName}`, {
      conversationId: conv,
    });
    const d1 = await getDraft(cust.userId, conv);

    const rCanc = await chatSalesman(cust.cookie, "chhod do", {
      conversationId: conv,
    });
    const d2 = await getDraft(cust.userId, conv);
    results.record(
      "C1",
      "explicit 'chhod do' clears the pending checkout draft",
      !!d1 && rCanc.status === 200 && d2 === null,
      { hadDraft: !!d1, cleared: d2 === null, tools: rCanc.tools },
    );

    const rAfter = await chatSalesman(
      cust.cookie,
      "ordering karna chhod diya, bag ka total batao",
      { conversationId: conv },
    );
    const d3 = await getDraft(cust.userId, conv);
    results.record(
      "C2",
      "draft stays cleared; next request is treated as a normal new request",
      d3 === null && hasTool(rAfter, ["get_my_cart"]),
      { cleared: d3 === null, tools: rAfter.tools },
    );
  } finally {
    await deleteDisposableCustomer(cust.userId).catch(() => {});
    await deleteDisposableProduct(prod.id).catch(() => {});
  }
}

// ── D. New conversation = ZERO focus (Khirke leak regression) ──────────────

async function t4_freshConversationZeroFocus() {
  const rA = await chatAdmin(adminCookie, "Khirke Jamawar ka price batao");
  const convA = rA.conversationId;
  const debugA = rA.text.toLowerCase();

  const rB = await chatAdmin(adminCookie, "aaj ki sales batao");
  const lowerB = rB.text.toLowerCase();
  const hasKhirke = lowerB.includes("khirke") || lowerB.includes("jamawar");
  results.record(
    "D1",
    "previously-discussed Khirke Jamawar in conversation A does NOT leak into a fresh conversation B",
    !!convA && convA !== rB.conversationId && rB.status === 200 && !hasKhirke,
    {
      convA,
      convB: rB.conversationId,
      snippetB: rB.text.slice(0, 160),
      toolsB: rB.tools,
      khirkeMentionedInB: hasKhirke,
    },
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  await ensureAdmin();
  await t1_adminProductDraftInterrupt();
  await t4_freshConversationZeroFocus();
  await t2_customerCheckoutDraftInterrupt();
  await t3_customerExplicitCancel();

  const summary = results.summary("DRAFT + CONVERSATION-STATE QA");
  process.exit(summary.fail > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

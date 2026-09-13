/**
 * ADMIN AI QA — Phase 0 safe + Phase 1 capability audit.
 *
 * Reads docs/fix.txt Phase 1/2 contract:
 *  - every mutation runs ONLY against disposable resources (QA TEMP product,
 *    disposable customer, disposable orders) and cleans them up afterwards
 *  - real catalog items, customers, orders are never modified
 *  - checks rules a–e: (a) real data only, (b) mutation verified before
 *    success claim, (c) normal ops no confirm / destructive-bulk ask once,
 *    (d) "isko/is order" resolves from recent context, (e) literal answer.
 *
 * Usage: node tests/qa/admin-ai-qa.mjs
 */
import {
  chatAdmin,
  createDisposableCustomer,
  createDisposableOrder,
  createDisposableProduct,
  deleteDisposableCustomer,
  deleteDisposableProduct,
  getFirst,
  projectRef,
  QaResults,
  queryRows,
  recentAuditLogs,
  serviceGet,
  servicePost,
  signIn,
  sleep,
} from "./lib/harness.mjs";

const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
const results = new QaResults();

let adminCookie = null;
let token = null;

async function ensureAdmin() {
  if (adminCookie) return;
  const auth = await signIn(ADMIN_EMAIL, ADMIN_PASSWORD);
  if (!auth.access_token) throw new Error("Admin login failed");
  adminCookie =
    `sb-${projectRef()}-auth-token=` +
    encodeURIComponent(JSON.stringify({
      access_token: auth.access_token,
      refresh_token: auth.refresh_token,
      expires_in: auth.expires_in,
      expires_at: auth.expires_at,
      token_type: "bearer",
      user: auth.user,
    }));
  console.log("[auth] admin:", auth.user.id);
}

const sessionCookie = (auth) =>
  `sb-${projectRef()}-auth-token=` +
  encodeURIComponent(JSON.stringify({
    access_token: auth.access_token,
    refresh_token: auth.refresh_token,
    expires_in: auth.expires_in,
    expires_at: auth.expires_at,
    token_type: "bearer",
    user: auth.user,
  }));

async function sendAdmin(message, conversationId) {
  return chatAdmin(adminCookie, message, conversationId ? { conversationId } : {});
}

function hasTool(res, names) {
  return res.tools.some((t) => names.includes(t));
}

const confirmationPhrase = /(confirm|confirmation|confirm karo|pakka|confirm? (kar|ho))|(delete|delete kar)? don\??|sure\??/i;

// ── Scenario implementations ───────────────────────────────────────────────

async function t1_todaySales() {
  const res = await sendAdmin("aaj ki sales batao");
  const toolOk = hasTool(res, ["get_sales_overview"]);
  const hasNumbers = /\d/.test(res.text);
  const mentionsPkr = /PKR|Rs\.?|rupees/i.test(res.text);
  results.record("A1", "today's sales", toolOk && hasNumbers, {
    tools: res.tools, evidence: `digits=${hasNumbers} pkr=${mentionsPkr}`,
    note: `"${res.text.slice(0, 140)}"`,
    mismatch: toolOk ? null : `expected get_sales_overview; got ${res.tools.join(",") || "none"}`,
  });
}

async function t2_dateRangeSales() {
  const res = await sendAdmin("last 7 days ki sales report do");
  const toolOk = hasTool(res, ["get_sales_overview"]);
  const hasNumbers = /\d/.test(res.text);
  results.record("A2", "date-range sales", toolOk && hasNumbers, {
    tools: res.tools,
    note: `"${res.text.slice(0, 140)}"`,
    mismatch: toolOk ? null : `expected get_sales_overview; got ${res.tools.join(",") || "none"}`,
  });
}

async function t3_allProducts() {
  const db = await queryRows("products", "is_active=eq.true", "select=id,name&limit=5")
    .catch(() => []);
  const realProduct = Array.isArray(db) && db.length ? db[0].name : null;
  const res = await sendAdmin("sare products ki detail do");
  const toolOk = hasTool(res, ["list_products", "search_products_admin"]);
  const mentionsReal = realProduct
    ? res.text.toLowerCase().includes(realProduct.slice(0, 8).toLowerCase())
    : true;
  results.record("A3", "full product list", toolOk && mentionsReal, {
    tools: res.tools, evidence: `dbFirst=${realProduct}, responseMatches=${mentionsReal}`,
    note: `"${res.text.slice(0, 140)}"`,
    mismatch: !toolOk ? `no list tool; got ${res.tools.join(",") || "none"}` : !mentionsReal ? "response did not clearly reflect real catalog" : null,
  });
}

async function t4_categoryFiltered() {
  const cat = await getFirst("categories", "slug=eq.jamawar");
  let jamawarFirst = null;
  if (cat) {
    const rows = await queryRows("products", `category_id=eq.${cat.id}`, "select=id,name&limit=1").catch(() => []);
    jamawarFirst = Array.isArray(rows) && rows.length ? rows[0].name : null;
  }
  const res = await sendAdmin("Jamawar category ke tamam products dikhao");
  const toolOk = hasTool(res, ["list_products", "list_categories"]);
  const mentionsReal = jamawarFirst
    ? res.text.toLowerCase().includes(jamawarFirst.slice(0, 8).toLowerCase())
    : true;
  results.record("A4", "category-filtered product list", toolOk && mentionsReal, {
    tools: res.tools, evidence: `jamawarSample=${jamawarFirst}`,
    note: `"${res.text.slice(0, 140)}"`,
    mismatch: !toolOk ? `expected product/category tools; got ${res.tools.join(",") || "none"}` : !mentionsReal ? "response missing real jamawar product" : null,
  });
}

async function t5_productDetail(disposable) {
  const target = disposable;
  const res = await sendAdmin(`"${target.name}" ka detail batao`);
  const toolOk = hasTool(res, ["get_product", "list_products", "search_products_admin"]);
  const mentions = res.text.toLowerCase().includes(target.name.toLowerCase().slice(0, 8));
  const inDb = (await getFirst("products", `slug=eq.${target.slug}`)) !== null;
  results.record("A5", "single product detail", toolOk && mentions && inDb, {
    tools: res.tools, evidence: `product=${target.name}`,
    note: `"${res.text.slice(0, 140)}"`,
    mismatch: !toolOk ? `no product tool; got ${res.tools.join(",") || "none"}` : null,
  });
}

async function t6_createProduct() {
  const t = `A${String(Date.now()).slice(-6)}`;
  token = t;
  const msg =
    `Ye ek naya test product hai jo main create karna chahta hoon. ` +
    `Naam: "QA TEMP ${t}", slug: "qa-temp-${t}", sku: "QAT-${t}", ` +
    `price: 4567, stock: 5, low stock threshold: 4, category: Jamawar. ` +
    `Description: "QA TEMP product for automated testing — delete after QA."`;
  const res = await sendAdmin(msg);
  const toolOk = hasTool(res, ["create_product"]);
  const row = await getFirst("products", `sku=eq.QAT-${t}`);
  const created = !!row;
  const responseMentions = res.text.includes("QA TEMP") || res.text.includes(t);
  results.record("A6", "create product", toolOk && created && responseMentions, {
    tools: res.tools, evidence: `dbRow=${created} sku=QAT-${t}`,
    note: `"${res.text.slice(0, 160)}"`,
    mismatch: !toolOk ? `no create_product tool; got ${res.tools.join(",") || "none"}` : !created ? "product not found in DB after AI claim" : null,
  });
  return row;
}

async function t7_editProduct(p) {
  const t = token;
  const marker = `QA TEMP edited ${t}`;
  const res = await sendAdmin(
    `Product "${p.name}" (sku QAT-${t}) ka description update karo. ` +
    `Naya description: "${marker}"`,
  );
  const toolOk = hasTool(res, ["update_product"]);
  const row = await getFirst("products", `id=eq.${p.id}`);
  const descMatches = !!row && row.description && row.description.includes(marker);
  results.record("A7", "edit product", toolOk && descMatches, {
    tools: res.tools, evidence: `dbDescriptionMatch=${descMatches}`,
    note: `"${res.text.slice(0, 140)}"`,
    mismatch: !toolOk ? `no update_product; got ${res.tools.join(",") || "none"}` : !descMatches ? "DB description did not match requested value" : null,
  });
  return { ...p, description: row?.description ?? p.description };
}

async function t8_deleteProduct(p) {
  const before = await getFirst("products", `id=eq.${p.id}`);
  const t1 = await sendAdmin(`"${p.name}" product ko delete kar do`);
  const deletedDirectly = (await getFirst("products", `id=eq.${p.id}`)) === null;
  const askedConfirm =
    /\?/.test(t1.text) && /(confirm|delete|kar doon|pakka|sure)/i.test(t1.text);

  let deletedRowCheck = deletedDirectly;
  let t2 = null;
  if (!deletedDirectly && t1.conversationId) {
    t2 = await sendAdmin("Haan, delete kar do.", t1.conversationId);
    deletedRowCheck = (await getFirst("products", `id=eq.${p.id}`)) === null;
  }

  const executedDelete = hasTool(t2 ?? t1, ["delete_product"]);
  const pass = !askedConfirm && deletedRowCheck && executedDelete;

  results.record("A8", "delete product (direct, no confirmation)", pass, {
    tools: [...t1.tools, ...(t2?.tools ?? [])],
    evidence: `existedBefore=${!!before}, deletedDirectly=${deletedDirectly}, deletedAfter=${deletedRowCheck}`,
    note: `turn1="${t1.text.slice(0, 120)}" | turn2="${t2 ? t2.text.slice(0, 120) : "(none)"}"`,
    mismatch: askedConfirm ? "AI asked for confirmation before deleting a single product"
      : !executedDelete ? "no delete_product tool call observed"
      : !deletedRowCheck ? "product still in DB despite delete request" : null,
  });
  return executedDelete;
}

async function t9_stockUpdate(p) {
  const res = await sendAdmin(`"${p.name}" ka stock 3 kar do`);
  const toolOk = hasTool(res, ["update_stock", "search_products_admin"]);
  const row = await getFirst("products", `id=eq.${p.id}`);
  const stockOk = !!row && row.stock_quantity === 3;
  results.record("A9", "stock update", toolOk && stockOk, {
    tools: res.tools, evidence: `dbStock=${row?.stock_quantity}`,
    note: `"${res.text.slice(0, 120)}"`,
    mismatch: !stockOk ? `expected stock 3; DB=${row?.stock_quantity}` : null,
  });
}

async function t10_lowStock() {
  const res = await sendAdmin("low stock products list karo");
  const toolOk = hasTool(res, ["list_low_stock_products"]);
  const low = await queryRows("products", "", "select=id,name,stock_quantity&is_active=eq.true").catch(() => []);
  const realLow = Array.isArray(low) ? low.filter((x) => x.stock_quantity <= 4) : [];
  const mentionsReal = realLow.length
    ? res.text.toLowerCase().includes(realLow[0].name.slice(0, 6).toLowerCase())
    : /\d/.test(res.text);
  results.record("A10", "low-stock list", toolOk && mentionsReal, {
    tools: res.tools, evidence: `dbLowCount=${realLow.length}`,
    note: `"${res.text.slice(0, 140)}"`,
    mismatch: !toolOk ? `no list_low_stock_products; got ${res.tools.join(",") || "none"}` : null,
  });
}

async function t11_listOrders() {
  const res = await sendAdmin("saare orders ki list do");
  const toolOk = hasTool(res, ["list_all_orders"]);
  const db = await queryRows("orders", "", "select=id,order_number&limit=1").catch(() => []);
  const hasReal = Array.isArray(db) && db.length
    ? res.text.toLowerCase().includes(String(db[0].order_number).toLowerCase().slice(0, 6))
    : /\d/.test(res.text);
  results.record("A11", "list orders", toolOk && hasReal, {
    tools: res.tools, evidence: `dbOrderSample=${db[0]?.order_number ?? "none"}`,
    note: `"${res.text.slice(0, 140)}"`,
    mismatch: !toolOk ? `no list_all_orders; got ${res.tools.join(",") || "none"}` : null,
  });
}

async function t12_orderDetail(order) {
  const res = await sendAdmin(`order "${order.order_number}" ki detail batao`);
  const toolOk = hasTool(res, ["get_order_detail", "list_all_orders"]);
  const mentions = res.text.toLowerCase().includes(order.order_number.toLowerCase().slice(0, 6));
  results.record("A12", "single order detail", toolOk && mentions, {
    tools: res.tools, evidence: `target=${order.order_number}`,
    note: `"${res.text.slice(0, 140)}"`,
    mismatch: !toolOk ? `no order detail tool; got ${res.tools.join(",") || "none"}` : !mentions ? "order number did not surface in reply" : null,
  });
}

async function t13_singleOrderStatus(order) {
  const res = await sendAdmin(
    `Order "${order.order_number}" ko confirm karo (status confirmed). Normal operation — matlab pending → confirmed.`,
  );
  const toolOk = hasTool(res, ["update_order_status"]);
  const row = await getFirst("orders", `id=eq.${order.id}`);
  const updated = !!row && row.status === "confirmed";
  results.record("A13", "single order status change (no confirm needed)", toolOk && updated, {
    tools: res.tools, evidence: `dbStatus=${row?.status}`,
    note: `"${res.text.slice(0, 140)}"`,
    mismatch: !updated ? `expected confirmed; DB=${row?.status}` : null,
  });
}

async function t14_bulkOrderStatus(customer, orders) {
  const fname = customer.fullName;

  const applied = async () =>
    (await getFirst("orders", `id=eq.${orders[0].id}`))?.status === "confirmed" &&
    (await getFirst("orders", `id=eq.${orders[1].id}`))?.status === "confirmed";

  // Turn 1: the bulk request itself. A category/customer-scoped bulk change
  // under 10 records must be applied DIRECTLY — no confirmation asked.
  const turn1 = await sendAdmin(
    `Customer "${fname}" (email ${customer.email}) ke saare pending orders ki status confirmed kar do (bulk update).`,
  );

  const turns = [turn1];
  if (!(await applied()) && turn1.conversationId) {
    turns.push(await sendAdmin(`Wohi wala: Customer "${fname}" ke pending orders confirmed kar do.`, turn1.conversationId));
  }

  const appliedWithoutConfirmation = await applied();
  const askedForConfirmation = turns.some((r) =>
    /\?/.test(r.text) && /(confirm|kar doon|pakka|sure|proceed)/i.test(r.text),
  );
  const toolEvents = turns.flatMap((r) => r.tools);

  results.record(
    "A14",
    "bulk order status change (applied without confirmation)",
    appliedWithoutConfirmation && !askedForConfirmation,
    {
      tools: toolEvents,
      evidence: `applied=${appliedWithoutConfirmation} asked=${askedForConfirmation}`,
      note: `turn1="${turns[0].text.slice(0, 140)}"${turns.length > 1 ? ` | turn2="${turns[1].text.slice(0, 140)}"` : ""}`,
      mismatch:
        askedForConfirmation
          ? "AI asked for confirmation on a <=10-record bulk change"
          : !appliedWithoutConfirmation
            ? "bulk change (<=10 records) was not applied directly in the turn"
            : null,
    },
  );
}

async function t15_customerList() {
  const res = await sendAdmin("sare customers ki list dikhao");
  const toolOk = hasTool(res, ["list_customers"]);
  const db = await queryRows("profiles", "role=eq.customer", "select=id&limit=1").catch(() => []);
  const hasData = Array.isArray(db) && db.length ? /\d|@|customer/i.test(res.text) : true;
  results.record("A15", "customer list", toolOk && hasData, {
    tools: res.tools, evidence: `dbCustomerCountEtc`,
    note: `"${res.text.slice(0, 140)}"`,
    mismatch: !toolOk ? `no list_customers; got ${res.tools.join(",") || "none"}` : null,
  });
}

async function t16_customerDetail(customer) {
  const res = await sendAdmin(`customer "${customer.fullName}" (email ${customer.email}) ki detail do`);
  const toolOk = hasTool(res, ["get_customer_detail", "list_customers"]);
  const row = await getFirst("profiles", `id=eq.${customer.userId}`);
  const mentions = row ? res.text.toLowerCase().includes(customer.fullName.toLowerCase().slice(0, 10)) : true;
  results.record("A16", "single customer detail", toolOk && mentions && (await getFirst("profiles", `id=eq.${customer.userId}`)) !== null, {
    tools: res.tools, evidence: `target=${customer.fullName}`,
    note: `"${res.text.slice(0, 140)}"`,
    mismatch: !toolOk ? `no customer detail tool; got ${res.tools.join(",") || "none"}` : !mentions ? "customer name did not surface in reply" : null,
  });
}

async function t17_marketing() {
  const res = await sendAdmin('"Khirke Jamawar" ke liye Instagram post ka copy likh do');
  const toolOk = hasTool(res, ["generate_social_post", "generate_product_marketing_copy", "generate_ad_copy"]);
  const hasText = res.text.length > 40;
  results.record("A17", "marketing copy generation", toolOk && hasText, {
    tools: res.tools, evidence: `replyLength=${res.text.length}`,
    note: `"${res.text.slice(0, 140)}"`,
    mismatch: !toolOk ? `no marketing tool; got ${res.tools.join(",") || "none"}` : !hasText ? "copy too short / empty" : null,
  });
}

async function t18_iskoResolution(p) {
  const t1 = await sendAdmin(`"${p.name}" ka detail batao`);
  const t2 = await sendAdmin("is ka stock 9 kar do", t1.conversationId || undefined);
  const row = await getFirst("products", `id=eq.${p.id}`);
  const resolved = !!row && row.stock_quantity === 9;
  const toolOk = hasTool(t2, ["update_stock"]);
  results.record("A18", "'isko/is order' reference resolution", toolOk && resolved, {
    tools: t1.tools.concat(t2.tools), evidence: `dbStock=${row?.stock_quantity}`,
    note: `turn2="${t2.text.slice(0, 140)}"`,
    mismatch: !resolved ? `'is ka stock 9' did not hit the referenced product; DB=${row?.stock_quantity}` : null,
  });
}

async function t19_literalOnly() {
  const res = await sendAdmin("sirf pending orders ki list batao, kuch aur nahi");
  const extraTools = res.tools.filter((t) =>
    !["list_all_orders", "get_order_detail"].includes(t),
  );
  results.record("A19", "literal question answered (no leftover action)", extraTools.length === 0, {
    tools: res.tools,
    evidence: `extraTools=${extraTools.join(",") || "none"}`,
    note: `"${res.text.slice(0, 120)}"`,
    mismatch: extraTools.length ? `unrelated tools fired: ${extraTools.join(",")}` : null,
  });
}

// ── Audit evidence summary ────────────────────────────────────────────────

async function auditEvidence(toolNames) {
  const logs = await recentAuditLogs(40);
  const matched = toolNames.filter((t) => logs.some((l) => l.tool_name === t));
  return {
    auditedNow: matched,
    statuses: logs.slice(0, 10).map((l) => `${l.agent_name}/${l.tool_name}=${l.status}`),
  };
}

// ── Runner ────────────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  ADMIN AI QA — Phase 0 safe (disposable data only)");
  console.log("═══════════════════════════════════════════════════════════\n");

  await ensureAdmin();

  // Phase 0: disposable resources
  const disposableCustomer = await createDisposableCustomer();
  console.log("[phase0] disposable customer:", disposableCustomer.email);

  const disposableProduct = await createDisposableProduct({ token: `A${String(Date.now()).slice(-6)}`, price: 4567, stock: 5, lowStockThreshold: 3, active: true });
  console.log("[phase0] disposable product:", disposableProduct.name, disposableProduct.id);

  const disposableOrder1 = await createDisposableOrder({
    customerId: disposableCustomer.userId,
    customerName: disposableCustomer.fullName,
    customerEmail: disposableCustomer.email,
    productId: disposableProduct.id,
    productName: disposableProduct.name,
    productPrice: 4567,
    quantity: 1,
  });
  const disposableOrder2 = await createDisposableOrder({
    customerId: disposableCustomer.userId,
    customerName: disposableCustomer.fullName,
    customerEmail: disposableCustomer.email,
    productId: disposableProduct.id,
    productName: disposableProduct.name,
    productPrice: 4567,
    quantity: 2,
  });
  const disposableOrder3 = await createDisposableOrder({
    customerId: disposableCustomer.userId,
    customerName: disposableCustomer.fullName,
    customerEmail: disposableCustomer.email,
    productId: disposableProduct.id,
    productName: disposableProduct.name,
    productPrice: 4567,
    quantity: 1,
  });
  console.log("[phase0] disposable orders:", disposableOrder1.order_number, disposableOrder2.order_number, disposableOrder3.order_number);

  const customerDetail = {
    userId: disposableCustomer.userId,
    email: disposableCustomer.email,
    fullName: disposableCustomer.fullName,
  };

  try {
    // Read-only basics first (A1–A4)
    await t1_todaySales();       await sleep(800);
    await t2_dateRangeSales();   await sleep(800);
    await t3_allProducts();      await sleep(800);
    await t4_categoryFiltered(); await sleep(800);

    // Create + edit the disposable product through the AI
    const created = await t6_createProduct(); await sleep(800);
    let p = created ?? disposableProduct;

    await t5_productDetail(p);   await sleep(800);
    p = (await t7_editProduct(p)) ;
    await sleep(800);
    await t9_stockUpdate(p);     await sleep(800);   // stock -> 3 (low)
    await t10_lowStock();        await sleep(800);

    // A18 "isko" resolution (stock -> 9)
    await t18_iskoResolution(p); await sleep(800);

    // Order tests on disposable orders
    await t11_listOrders();      await sleep(800);
    await t12_orderDetail(disposableOrder1); await sleep(800);
    await t13_singleOrderStatus(disposableOrder1); await sleep(800);
    await t14_bulkOrderStatus(customerDetail, [disposableOrder2, disposableOrder3]); await sleep(800);

    // Customer tests (read-only)
    await t15_customerList();    await sleep(800);
    await t16_customerDetail(customerDetail); await sleep(800);

    // Marketing
    await t17_marketing();       await sleep(800);

    // Literal-only
    await t19_literalOnly();     await sleep(800);

    // Delete the disposable product through the AI (confirmation gate)
    await t8_deleteProduct(p);
  } catch (e) {
    console.error("[fatal] admin QA error:", e);
  } finally {
    // Phase 0: cleanup
    console.log("\n[cleanup] deleting disposable data…");
    await deleteDisposableCustomer(disposableCustomer.userId).catch((e) =>
      console.log("  [cleanup] customer:", e.message),
    );
    await deleteDisposableProduct(disposableProduct.id).catch((e) =>
      console.log("  [cleanup] product:", e.message),
    );
    if (token) {
      const stray = await getFirst("products", `sku=eq.QAT-${token}`).catch(() => null);
      if (stray) await deleteDisposableProduct(stray.id).catch(() => {});
    }
    console.log("[cleanup] done. verifying residue…");
    const residueOrderCount = (await queryRows("orders", `user_id=eq.${disposableCustomer.userId}`, "").catch(() => []));
    const residueProduct = await getFirst("products", `sku=eq.${disposableProduct.sku}`).catch(() => null);
    console.log(`  residueOrders=${Array.isArray(residueOrderCount) ? residueOrderCount.length : "?"} residueProduct=${residueProduct ? "PRESENT" : "gone"}`);
  }

  const summary = results.summary("ADMIN AI QA RESULTS");
  const failures = results.onlyFailures();
  if (failures.length) {
    console.log("FAILED scenarios:");
    for (const f of failures) {
      console.log(`  ✗ ${f.id}: ${f.scenario}`);
      if (f.mismatch) console.log(`      ${f.mismatch}`);
    }
  }
  return summary;
}

main().catch((e) => { console.error("crash:", e); process.exit(1); });
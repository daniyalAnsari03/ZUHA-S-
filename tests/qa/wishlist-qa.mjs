/**
 * Permanent regression test: the wishlist must genuinely persist.
 *
 * Covers the chain end to end in a real browser against a real disposable
 * customer:
 *   add to wishlist (product detail) -> reload -> still saved
 *   -> /wishlist lists the product
 *   -> remove from /wishlist -> reload -> gone
 *
 * This is the coverage the "wishlist does not save anything" bug needed. The
 * failure it guards against was silent: the write succeeded, the button flipped
 * to the saved state, and only the read was broken — so the database is checked
 * directly as well as through the UI.
 *
 * Usage: node tests/qa/wishlist-qa.mjs
 */
import {
  createDisposableCustomer,
  deleteDisposableCustomer,
  getFirst,
  queryRows,
  uniqueToken,
} from "./lib/harness.mjs";
import { launchChrome, openPage, sleep } from "./lib/cdp.mjs";

const BASE = process.env.QA_BASE_URL || "http://127.0.0.1:3210";
const PORT = Number(process.env.QA_CDP_PORT || 9412);
const PASSWORD = "QaPass!1234";
const PRODUCT_SLUG = process.env.QA_WISHLIST_SLUG || "buta-jaal";

let failures = 0;
const check = (label, ok, detail = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
};

const tok = uniqueToken();
const customer = await createDisposableCustomer({ token: tok });
console.log("customer:", customer.email);

const chrome = await launchChrome({ port: PORT });
const page = await openPage(PORT, { width: 412, height: 900 });

try {
  // --- sign in through the real UI -----------------------------------------
  await page.goto(`${BASE}/login`, { waitMs: 800 });
  await page.type("#email", customer.email);
  await page.type("#password", PASSWORD);
  await page.clickSelector('button[type="submit"]');
  await page.waitFor(`location.pathname !== "/login"`, { timeout: 30000 });
  check("signs in through the login form", true, await page.url());

  // --- add to wishlist ------------------------------------------------------
  await page.goto(`${BASE}/product/${PRODUCT_SLUG}`, { waitMs: 1500 });
  const addBtn = 'button[aria-label="Add to wishlist"]';
  const removeBtn = 'button[aria-label="Remove from wishlist"]';
  await page.waitFor(`!!document.querySelector('${addBtn}')`, { timeout: 20000 });

  await page.clickSelector(addBtn);
  await page.waitFor(
    `!!document.querySelector('${removeBtn}')`,
    { timeout: 20000 },
  );
  check("heart switches to the saved state after clicking", true);

  // --- database truth -------------------------------------------------------
  await sleep(600);
  const wishlists = await queryRows("wishlists", `user_id=eq.${customer.userId}`);
  check("a wishlist row exists for the customer", (wishlists ?? []).length === 1);
  const items = wishlists?.[0]?.id
    ? await queryRows("wishlist_items", `wishlist_id=eq.${wishlists[0].id}`)
    : [];
  check("a wishlist_items row was written", (items ?? []).length === 1);

  // --- survives a full page reload -----------------------------------------
  await page.goto(`${BASE}/product/${PRODUCT_SLUG}`, { waitMs: 1500 });
  await page.waitFor(`!!document.querySelector('${removeBtn}')`, { timeout: 20000 });
  check(
    "still saved after a full page reload",
    true,
    "server-rendered initialSaved state",
  );

  // --- appears on /wishlist -------------------------------------------------
  await page.goto(`${BASE}/wishlist`, { waitMs: 1500 });
  const listed = await page.eval(`
    const main = document.querySelector('main');
    const text = main ? main.innerText.replace(/\\s+/g, ' ') : '';
    return {
      empty: /wishlist is empty/i.test(text),
      text: text.slice(0, 200),
    };
  `);
  check(
    "/wishlist is not the empty state",
    !listed.empty,
    listed.text,
  );

  const productRow = await getFirst(
    "wishlist_items",
    `wishlist_id=eq.${wishlists?.[0]?.id ?? "00000000-0000-0000-0000-000000000000"}`,
  );
  check(
    "the wishlist row links a real product",
    !!productRow?.product_id,
    productRow?.product_id ?? "none",
  );

  // --- remove from /wishlist ------------------------------------------------
  const removeSelector =
    'form button[aria-label^="Remove "][type="submit"]';
  await page.waitFor(`!!document.querySelector('${removeSelector}')`, {
    timeout: 20000,
  });
  await page.clickSelector(removeSelector);
  await sleep(2500);
  await page.goto(`${BASE}/wishlist`, { waitMs: 1500 });
  const afterRemove = await page.eval(`
    const main = document.querySelector('main');
    const text = main ? main.innerText.replace(/\\s+/g, ' ') : '';
    return {
      empty: /wishlist is empty/i.test(text),
      text: text.slice(0, 160),
    };
  `);
  check(
    "/wishlist is empty again after removing",
    afterRemove.empty,
    afterRemove.text,
  );

  const remaining = await queryRows(
    "wishlist_items",
    `wishlist_id=eq.${wishlists?.[0]?.id ?? "00000000-0000-0000-0000-000000000000"}`,
  );
  check(
    "the wishlist_items row was deleted",
    (remaining ?? []).length === 0,
    `${(remaining ?? []).length} row(s) left`,
  );
} catch (error) {
  failures += 1;
  console.error("  FAIL  unexpected error:", error?.message ?? error);
} finally {
  await page.close();
  await chrome.close();
  await deleteDisposableCustomer(customer.userId);
}

console.log(
  failures === 0
    ? "\nWishlist persistence QA passed."
    : `\nWishlist persistence QA failed with ${failures} failing check(s).`,
);
process.exit(failures === 0 ? 0 : 1);

/**
 * Collect real detail-page ids from the running app so the responsive audit
 * can cover detail routes too (not just list pages).
 *
 * Usage: node tests/qa/discover-detail-routes.mjs [baseUrl]
 */
import { launchChrome, openPage, sleep } from "./lib/cdp.mjs";
import "./load-env.mjs";

const BASE = (process.argv[2] || "http://127.0.0.1:3210").replace(/\/$/, "");
const PORT = 9361;

const chrome = await launchChrome({ port: PORT });
const page = await openPage(PORT, { width: 1440, height: 900 });

async function links(url, pattern) {
  await page.goto(`${BASE}${url}`, { waitMs: 800 });
  return page.eval(`
    const re = new RegExp(${JSON.stringify(pattern)});
    const out = [...new Set([...document.querySelectorAll("a[href]")]
      .map(a => a.getAttribute("href"))
      .filter(h => re.test(h)))];
    return out.slice(0, 3);
  `);
}

try {
  await page.goto(`${BASE}/login`, { waitMs: 300 });
  await page.type("#email", process.env.ADMIN_EMAIL);
  await page.type("#password", process.env.ADMIN_PASSWORD);
  await page.clickSelector('button[type="submit"]');
  await page.waitFor(`location.pathname !== "/login"`, { timeout: 25000, poll: 100 });
  await sleep(800);

  const found = {
    "admin-product-edit": await links("/admin/products", "^\/admin\/products\/[0-9a-f-]+\/edit$"),
    "admin-category-edit": await links("/admin/categories", "^\/admin\/categories\/[0-9a-f-]+\/edit$"),
    "admin-order-detail": await links("/admin/orders", "^\/admin\/orders\/[0-9a-f-]+$"),
    "admin-customer-detail": await links("/admin/customers", "^\/admin\/customers\/[0-9a-f-]+$"),
    "storefront-order": await links("/orders", "^\/orders\/[0-9a-f-]+$"),
    "storefront-notification": await links("/notifications", "^\/notifications\/[0-9a-f-]+$"),
    "admin-notification-detail": await links("/admin/notifications", "^\/admin\/notifications\/[0-9a-f-]+$"),
  };
  console.log(JSON.stringify(found, null, 1));
} finally {
  await page.close();
  await chrome.close();
}

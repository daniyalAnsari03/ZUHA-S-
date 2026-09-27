/**
 * Per-page responsiveness audit across storefront and admin, in a real
 * browser: horizontal overflow, elements escaping the viewport, oversized tap
 * targets and runtime errors, at phone / tablet / desktop widths.
 *
 * Usage: node tests/qa/responsive-audit.mjs [baseUrl]
 */
import { launchChrome, openPage, sleep } from "./lib/cdp.mjs";
import "./load-env.mjs";

const BASE = (
  process.argv[2] ||
  process.env.QA_BASE_URL ||
  "http://127.0.0.1:3210"
).replace(/\/$/, "");
const PORT = 9360;

const VIEWPORTS = [
  { name: "phone", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
];

const DETAIL = {
  "admin-product-edit": "/admin/products/43fcf170-70d5-41ac-a754-95a1d9b29072/edit",
  "admin-category-edit": "/admin/categories/17a8a9e5-7b4e-46cd-8043-be2ad7a4a742/edit",
  "admin-order-detail": "/admin/orders/7e714e1a-eddb-4866-9e82-6f6a5f7c0324",
  "admin-customer-detail": "/admin/customers/cc6011f9-b064-4631-8f44-57f7a34cf5cc",
  "admin-notification-detail": "/admin/notifications/4c2c2c01-cec1-4d1f-865f-b17190ca5203",
};

const PAGES = [
  { name: "home", url: "/" },
  { name: "shop", url: "/shop" },
  { name: "shop-category", url: "/shop?category=jamawar" },
  { name: "product", url: "/product/buta-jaal" },
  { name: "cart", url: "/cart" },
  { name: "checkout", url: "/checkout" },
  { name: "wishlist", url: "/wishlist" },
  { name: "login", url: "/login" },
  { name: "signup", url: "/signup" },
  { name: "account", url: "/account", auth: "admin" },
  { name: "orders", url: "/orders", auth: "admin" },
  { name: "order-detail", url: DETAIL["admin-order-detail"], auth: "admin" },
  { name: "notifications", url: "/notifications", auth: "admin" },
  { name: "notification-detail", url: DETAIL["admin-notification-detail"], auth: "admin" },
  { name: "admin-dashboard", url: "/admin", auth: "admin" },
  { name: "admin-products", url: "/admin/products", auth: "admin" },
  { name: "admin-products-edit", url: DETAIL["admin-product-edit"], auth: "admin" },
  { name: "admin-product-new", url: "/admin/products/new", auth: "admin" },
  { name: "admin-categories", url: "/admin/categories", auth: "admin" },
  { name: "admin-categories-edit", url: DETAIL["admin-category-edit"], auth: "admin" },
  { name: "admin-inventory", url: "/admin/inventory", auth: "admin" },
  { name: "admin-orders", url: "/admin/orders", auth: "admin" },
  { name: "admin-order-detail", url: DETAIL["admin-order-detail"], auth: "admin" },
  { name: "admin-customers", url: "/admin/customers", auth: "admin" },
  { name: "admin-customer-detail", url: DETAIL["admin-customer-detail"], auth: "admin" },
  { name: "admin-announcements", url: "/admin/announcements", auth: "admin" },
  { name: "admin-homepage", url: "/admin/homepage", auth: "admin" },
  { name: "admin-media", url: "/admin/media", auth: "admin" },
  { name: "admin-notifications", url: "/admin/notifications", auth: "admin" },
  { name: "admin-notification-detail", url: DETAIL["admin-notification-detail"], auth: "admin" },
  { name: "admin-analytics", url: "/admin/analytics", auth: "admin" },
  { name: "admin-reports", url: "/admin/reports", auth: "admin" },
  { name: "admin-ai", url: "/admin/ai", auth: "admin" },
];

const MEASURE = `
  const vw = document.documentElement.clientWidth;
  const scrollW = Math.max(
    document.documentElement.scrollWidth,
    document.body ? document.body.scrollWidth : 0,
  );
  const path = (el) => {
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && parts.length < 4) {
      let sel = node.tagName.toLowerCase();
      if (node.id) sel += "#" + node.id;
      const cls = (node.getAttribute("class") || "").trim().split(/\\s+/).slice(0, 3).join(".");
      if (cls) sel += "." + cls;
      parts.unshift(sel);
      node = node.parentElement;
    }
    return parts.join(" > ");
  };
  const inScroller = (el) => {
    let p = el.parentElement;
    while (p && p !== document.body) {
      const ov = getComputedStyle(p).overflowX;
      if (ov === "auto" || ov === "scroll" || ov === "hidden") return true;
      p = p.parentElement;
    }
    return false;
  };
  const escaping = [];
  for (const el of document.querySelectorAll("body *")) {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0") continue;
    if (cs.position === "fixed") continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right > vw + 1 || r.left < -1) {
      if (inScroller(el)) continue;
      escaping.push({
        path: path(el),
        left: Math.round(r.left),
        right: Math.round(r.right),
        width: Math.round(r.width),
      });
    }
  }
  const smallTargets = [];
  for (const el of document.querySelectorAll('a, button, input, select, textarea, [role="button"]')) {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (cs.position === "fixed") continue;
    const isControl = el.tagName !== "A" && el.tagName !== "AREA";
    // Inline text links are allowed to be short; real controls are not.
    if (!isControl && cs.display === "inline") continue;
    if (!isControl && (el.textContent || "").trim().length > 40) continue;
    const min = isControl ? 30 : 32;
    if (r.height < min || r.width < min) {
      smallTargets.push({ path: path(el), text: (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) });
    }
  }
  return {
    vw,
    scrollW,
    overflow: scrollW - vw,
    escaping: escaping.slice(0, 6),
    smallTargets: smallTargets.slice(0, 6),
    smallCount: smallTargets.length,
    text: (document.body.innerText || "").trim().slice(0, 80),
  };
`;

const chrome = await launchChrome({ port: PORT });
const page = await openPage(PORT, { width: 1440, height: 900 });
let signedInAs = null;
const problems = [];

async function loginAs(who) {
  if (signedInAs === who) return;
  await page.send("Network.clearBrowserCookies");
  await page.goto(`${BASE}/login`, { waitMs: 400 });
  await page.type("#email", who === "customer" ? process.env.CUSTOMER_EMAIL : process.env.ADMIN_EMAIL);
  await page.type("#password", who === "customer" ? process.env.CUSTOMER_PASSWORD : process.env.ADMIN_PASSWORD);
  await page.clickSelector('button[type="submit"]');
  const ok = await page.waitFor(`location.pathname !== "/login"`, { timeout: 25000, poll: 100 });
  if (!ok) throw new Error(`${who} login failed`);
  signedInAs = who;
  await sleep(800);
}

try {
  for (const vp of VIEWPORTS) {
    await page.send("Emulation.setDeviceMetricsOverride", {
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: 1,
      mobile: vp.width < 700,
    });
    console.log(`\n### ${vp.name} ${vp.width}x${vp.height}`);

    for (const p of PAGES) {
      if (p.auth) await loginAs(p.auth);

      const before = page.consoleErrors.length + page.pageErrors.length;
      await page.goto(`${BASE}${p.url}`, { waitMs: 900 });

      let target = p.url;
      if (p.follow) {
        const found = await page.eval(`
          const el = document.querySelector(${JSON.stringify(p.follow)});
          return el ? el.getAttribute("href") : null;
        `);
        if (!found) {
          console.log(`skip ${p.name} (no ${p.follow} link on ${p.url})`);
          continue;
        }
        target = found;
        await page.goto(`${BASE}${target}`, { waitMs: 900 });
      }

      const m = await page.eval(MEASURE);
      const errs = page.consoleErrors.length + page.pageErrors.length - before;
      const redirected = (await page.url()).replace(BASE, "");

      const flags = [];
      if (m.overflow > 1) flags.push(`overflow +${m.overflow}px`);
      if (m.escaping.length) flags.push(`${m.escaping.length} escaping els`);
      if (m.smallCount) flags.push(`${m.smallCount} small targets`);
      if (errs) flags.push(`${errs} runtime errors`);
      if (p.auth && redirected.includes("/login")) flags.push("redirected to /login");

      const line = `${flags.length ? "WARN" : "ok  "} ${p.name.padEnd(26)} ${target.padEnd(52)} ${flags.join(" | ") || "clean"}`;
      console.log(line);
      if (flags.length) {
        problems.push({ vp: vp.name, page: p.name, url: target, flags, m, redirected });
        for (const e of m.escaping) {
          console.log(`       escaping: ${e.path} [${e.left}..${e.right}] w=${e.width}`);
        }
        for (const s of m.smallTargets) {
          console.log(`       small: ${s.path} "${s.text}" ${s.w}x${s.h}`);
        }
        if (errs) {
          for (const e of [...page.pageErrors, ...page.consoleErrors].slice(before)) {
            console.log(`       error: ${e.slice(0, 160)}`);
          }
        }
      }
    }
  }
} finally {
  await page.close();
  await chrome.close();
}

console.log(`\npages with findings: ${problems.length} checks across ${VIEWPORTS.length} viewports`);
process.exit(0);

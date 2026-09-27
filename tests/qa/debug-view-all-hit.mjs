/**
 * Debug probe for the "View All Products" hit-testing race.
 * Usage: node tests/qa/debug-view-all-hit.mjs [baseUrl]
 */
import { launchChrome, openPage, sleep } from "./lib/cdp.mjs";

const BASE = (process.argv[2] || "http://127.0.0.1:3210").replace(/\/$/, "");
const PORT = 9346;

const chrome = await launchChrome({ port: PORT });
const page = await openPage(PORT, { width: 1440, height: 900 });

async function probe(index, waitMs) {
  await page.goto(`${BASE}/`, { waitMs });
  const info = await page.eval(`
    const el = document.querySelectorAll('a[href^="/shop?category="]')[${index}];
    if (!el) return { error: "missing" };
    el.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const hit = document.elementFromPoint(cx, cy);
    const before = { scrollY: window.scrollY, docH: document.documentElement.scrollHeight, rect: { top: r.top, left: r.left, w: r.width, h: r.height }, cx, cy, hit: hit ? hit.tagName + "|" + (hit.className||"").toString().slice(0,50) : null, text: (el.textContent||"").trim().slice(0,40) };
    await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
    const r2 = el.getBoundingClientRect();
    const cx2 = r2.left + r2.width / 2, cy2 = r2.top + r2.height / 2;
    const hit2 = document.elementFromPoint(cx2, cy2);
    return { before, after: { scrollY: window.scrollY, docH: document.documentElement.scrollHeight, rect: { top: r2.top }, cx: cx2, cy: cy2, hit: hit2 ? hit2.tagName + "|" + (hit2.className||"").toString().slice(0,50) : null } };
  `);
  return info;
}

for (const waitMs of [0, 300, 1000]) {
  for (const index of [0, 1, 2]) {
    const p = await probe(index, waitMs);
    console.log(`waitMs=${waitMs} row=${index}`);
    console.log("  before:", JSON.stringify(p.before ?? p));
    console.log("  after :", JSON.stringify(p.after ?? null));
  }
}

await page.close();
await chrome.close();

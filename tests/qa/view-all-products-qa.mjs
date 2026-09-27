/**
 * Real-browser QA: "View All Products" on homepage product rows.
 *
 * Reproduces the reported failure mode - clicking the link right after a fresh
 * page load, before animations/layout have settled - using genuine input-level
 * mouse events at the element's viewport coordinates (not element.click(),
 * which bypasses hit testing and would hide an overlay problem).
 *
 * Usage: node tests/qa/view-all-products-qa.mjs [baseUrl]
 */
import { launchChrome, openPage, sleep } from "./lib/cdp.mjs";

const BASE = (
  process.argv[2] ||
  process.env.QA_BASE_URL ||
  "http://127.0.0.1:3210"
).replace(/\/$/, "");
const LABEL = "View All Products";
const PORT = 9345;

const results = [];
let failures = 0;

function record(scope, attempt, ok, detail) {
  results.push({ scope, attempt, ok, detail });
  if (!ok) failures++;
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${scope} attempt ${attempt}: ${detail}`);
}

/** Fresh load, click row `index` as soon as it is laid out, expect navigation. */
async function clickRow(page, index, { width, height, settleMs = 0 }) {
  await page.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: width < 700 ? 2 : 1,
    mobile: width < 700,
  });
  await page.goto(`${BASE}/`, { waitMs: settleMs });

  const box = await page.waitForText(LABEL, index, { timeout: 20000, poll: 20 });
  if (!box || box.missing) return { ok: false, detail: "link never rendered" };
  if (box.unlaid) return { ok: false, detail: "link had no layout box" };
  if (box.covered) return { ok: false, detail: `covered by ${box.hitTag}` };

  // Re-read the box right before clicking: framer-motion reveals and image
  // loads shift layout, and a stale coordinate would test the wrong pixels.
  const fresh = await page.boxByText(LABEL, index);
  if (!fresh || fresh.missing) return { ok: false, detail: "link vanished before click" };
  if (fresh.unlaid) return { ok: false, detail: "link had no layout box before click" };
  if (fresh.covered) {
    return { ok: false, detail: `covered by ${fresh.hitTag} just before click` };
  }

  const expected = new URL(fresh.href, BASE).pathname + new URL(fresh.href, BASE).search;
  await page.clickAt(fresh.x, fresh.y);
  const navigated = await page.waitFor(
    `location.pathname === ${JSON.stringify(new URL(expected, BASE).pathname)}`,
    { timeout: 10000, poll: 25 },
  );
  const url = await page.url();
  return {
    ok: navigated && url.replace(BASE, "") === expected,
    detail: navigated
      ? `-> ${url.replace(BASE, "")} (expected ${expected})`
      : `no navigation, still on ${url.replace(BASE, "")}`,
    href: fresh.href,
    url,
  };
}

const chrome = await launchChrome({ port: PORT });
const page = await openPage(PORT, { width: 1440, height: 900 });

try {
  for (const [label, width, height, attempts] of [
    ["desktop 1440x900", 1440, 900, 6],
    ["laptop 1280x800", 1280, 800, 4],
    ["tablet 768x1024", 768, 1024, 4],
    ["mobile 390x844", 390, 844, 6],
  ]) {
    console.log(`\n${label}`);
    for (const index of [0, 1, 2]) {
      for (let attempt = 1; attempt <= attempts; attempt++) {
        const r = await clickRow(page, index, { width, height });
        record(`${label} row ${index + 1}`, attempt, r.ok, r.detail);
      }
    }
  }

  // Two clicks in rapid succession on the same freshly loaded row.
  console.log("\nrapid repeat clicks on one load (desktop)");
  for (let round = 1; round <= 3; round++) {
    const r = await clickRow(page, 1, { width: 1440, height: 900 });
    record(`double-click row 2 round ${round}`, round, r.ok, r.detail);
  }

  // The destination must actually be the right filtered shop page.
  console.log("\ndestination content check");
  await page.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  for (const index of [0, 1, 2]) {
    await page.goto(`${BASE}/`, { waitMs: 200 });
    const box = await page.waitForText(LABEL, index, { timeout: 20000 });
    if (!box || box.missing) {
      record(`destination row ${index + 1}`, 1, false, "link never rendered");
      continue;
    }
    const fresh = await page.boxByText(LABEL, index);
    await page.clickAt(fresh.x, fresh.y);
    const ok = await page.waitFor(`location.pathname === "/shop"`, {
      timeout: 10000,
      poll: 25,
    });
    await sleep(700);
    const info = await page.eval(`
      const cards = document.querySelectorAll('a[href^="/product/"]').length;
      const heading2 = [...document.querySelectorAll("h1,h2")].map(h => h.textContent.trim()).slice(0,3);
      return { cards, heading2, url: location.href };
    `);
    const expected = new URL(box.href, BASE);
    const landed = info.url.replace(BASE, "") === expected.pathname + expected.search;
    record(
      `destination row ${index + 1} (${box.href})`,
      1,
      ok && landed && info.cards > 0,
      `${info.cards} product links, headings ${JSON.stringify(info.heading2)}, url ${info.url.replace(BASE, "")}`,
    );
  }

  console.log(
    `\nconsole errors: ${page.consoleErrors.length}, page errors: ${page.pageErrors.length}`,
  );
  for (const e of [...page.pageErrors, ...page.consoleErrors].slice(0, 8)) {
    console.log(`  ! ${e.slice(0, 200)}`);
  }
} finally {
  await page.close();
  await chrome.close();
}

console.log(
  `\n${results.length - failures}/${results.length} view-all-products checks passed`,
);
process.exit(failures === 0 ? 0 : 1);

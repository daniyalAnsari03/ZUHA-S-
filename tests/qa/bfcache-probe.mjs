/**
 * Direct bfcache probe — the only trustworthy check.
 *
 * Lighthouse's `bf-cache` audit reports "eligible" from heuristics and did not
 * notice the `Cache-Control: no-store` that Next.js puts on every dynamically
 * rendered route, so it cannot be trusted here. This probe measures the real
 * thing:
 *
 *   1. load the page, stamp a marker on `window`
 *   2. navigate to another page (discarding this document)
 *   3. go back
 *   4. the marker is still there  =>  the document was restored from bfcache
 *
 * It also records how many network requests the back navigation actually made
 * and what `PerformanceNavigationTiming` reports, and prints the response
 * headers that would disqualify the page (`no-store`, unload handlers, etc).
 *
 * Usage: node tests/qa/bfcache-probe.mjs [page ...]
 */
import { launchChrome, openPage, sleep } from "./lib/cdp.mjs";

const BASE = (process.env.QA_BASE_URL || "http://127.0.0.1:3210").replace(
  /\/$/,
  "",
);
const PORT = Number(process.env.QA_CDP_PORT || 9375);
const PATHS = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["/", "/shop?category=jamawar", "/product/buta-jaal"];

const chrome = await launchChrome({ port: PORT });
const page = await openPage(PORT, { width: 412, height: 823 });
let failures = 0;

try {
  for (const path of PATHS) {
    const res = await fetch(`${BASE}${path}`);
    const cc = res.headers.get("cache-control") || "(none)";
    const blocks = [];
    if (/no-store/i.test(cc)) blocks.push("no-store");
    if (/no-cache/i.test(cc)) blocks.push("no-cache (revalidation, still bfcache-able)");

    await page.send("Network.enable");
    let requests = 0;
    page.on("Network.requestWillBeSent", () => {
      requests += 1;
    });

    await page.goto(`${BASE}${path}`, { waitMs: 1500 });
    await page.eval(`window.__bfcacheProbe = "alive";`);
    // A real user navigates to another document, then comes back.
    await page.goto(`${BASE}/about`, { waitMs: 1200 });
    requests = 0;
    await page.goBack({ waitMs: 1500 });
    await sleep(400);

    const after = await page.eval(`
      const n = performance.getEntriesByType("navigation")[0];
      return {
        marker: window.__bfcacheProbe || null,
        type: n ? n.type : null,
        restored: n && "activationStart" in n ? n.activationStart > 0 : null,
        domNodes: document.querySelectorAll("*").length,
        path: location.pathname + location.search,
      };
    `);

    const restored = after.marker === "alive";
    if (!restored) failures += 1;
    console.log(
      `${restored ? "PASS" : "FAIL"}  ${after.path.padEnd(28)} restored=${restored} navType=${after.type} requestsOnBack=${requests} nodes=${after.domNodes}`,
    );
    console.log(`      Cache-Control: ${cc}`);
    if (blocks.length) console.log(`      blockers: ${blocks.join(", ")}`);
  }
} finally {
  await page.close();
  await chrome.close();
}

console.log(
  failures === 0
    ? "\nbfcache probe: all pages restored from bfcache."
    : `\nbfcache probe: ${failures} page(s) were NOT restored from bfcache.`,
);
process.exit(failures === 0 ? 0 : 1);

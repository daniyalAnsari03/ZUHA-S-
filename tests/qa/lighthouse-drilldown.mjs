/**
 * Print the actionable diagnostics out of saved Lighthouse reports so the
 * performance numbers come with their causes attached.
 *
 * Usage: node tests/qa/lighthouse-drilldown.mjs <reportDir>
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2];
if (!dir) {
  console.error("usage: node tests/qa/lighthouse-drilldown.mjs <reportDir>");
  process.exit(2);
}

const kb = (n) => `${Math.round(n / 1024)} KB`;

for (const file of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
  const lhr = JSON.parse(readFileSync(join(dir, file), "utf8"));
  const a = lhr.audits;
  console.log(`\n===== ${file} (${lhr.finalDisplayedUrl}) =====`);

  const diag = a["diagnostics"]?.details?.items?.[0];
  if (diag) {
    console.log(
      `main thread: total ${Math.round(diag.mainThreadTime)}ms | tasks ${diag.numTasks} | bootup ${Math.round(diag.bootupTime)}ms | layout ${Math.round(diag.layoutCount)} (${Math.round(diag.layoutDuration)}ms) | recalc-style ${Math.round(diag.recalcStyleCount)} (${Math.round(diag.recalcStyleDuration)}ms) | script ${Math.round(diag.scriptingDuration)}ms`,
    );
  }

  const lcpEl = a["largest-contentful-paint-element"]?.details?.items?.[0];
  if (lcpEl?.items?.[0]?.node?.snippet) {
    console.log(`LCP element: ${lcpEl.items[0].node.snippet.slice(0, 140)}`);
  }

  const phases = a["lcp-breakdown-insight"]?.details?.items;
  if (phases) {
    console.log(
      `LCP phases: ${phases.map((p) => `${p.phase} ${Math.round(p.timing)}ms`).join(", ")}`,
    );
  }

  const unused = (a["unused-javascript"]?.details?.items || [])
    .slice(0, 5)
    .map((i) => `${kb(i.totalBytes)} total / ${kb(i.wastedBytes)} unused (${i.url.split("/").pop()})`);
  if (unused.length) console.log(`unused JS: ${unused.join(" | ")}`);

  const boot = (a["bootup-time"]?.details?.items || [])
    .slice(0, 5)
    .map((i) => `${Math.round(i.total)}ms ${i.url.split("/").pop()}`);
  if (boot.length) console.log(`bootup: ${boot.join(" | ")}`);

  const longTasks = (a["long-tasks"]?.details?.items || [])
    .slice(0, 5)
    .map((i) => `${Math.round(i.duration)}ms @${Math.round(i.startTime)}ms ${(i.url || "").split("/").pop()}`);
  if (longTasks.length) console.log(`long tasks: ${longTasks.join(" | ")}`);

  const third = (a["third-party-summary"]?.details?.items || [])
    .slice(0, 5)
    .map((i) => `${i.entity} ${kb(i.transferSize)}`);
  if (third.length) console.log(`third party: ${third.join(" | ")}`);

  const imgs = (a["network-requests"]?.details?.items || [])
    .filter((i) => i.resourceType === "Image")
    .sort((x, y) => (y.transferSize || 0) - (x.transferSize || 0))
    .slice(0, 4)
    .map((i) => `${kb(i.transferSize)} ${(i.url || "").split("/").pop().slice(0, 60)}`);
  if (imgs.length) console.log(`heaviest images: ${imgs.join(" | ")}`);

  const failed = Object.entries(a)
    .filter(([, v]) => v && v.score !== null && v.score < 0.9)
    .map(([k, v]) => `${k}=${v.score}`);
  if (failed.length) console.log(`scoring audits below 0.9: ${failed.join(", ")}`);

  const bf = a["bf-cache"]?.details?.items?.[0];
  if (bf) {
    console.log(
      `bf-cache: ${bf.notEligibleReasons?.length ? bf.notEligibleReasons.map((r) => r.reason).join(" | ") : "eligible"}`,
    );
  }
}

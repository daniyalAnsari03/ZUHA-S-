/**
 * Print the diagnostics that matter from a directory of raw Lighthouse JSON
 * reports written by lighthouse-audit.mjs: LCP element and its phases, the
 * long-task breakdown, bfcache blockers, the largest unused-JS chunks and the
 * heaviest requests. Read-only inspection of an existing report set.
 *
 * Usage: node tests/qa/lh-inspect.mjs <reportDir> [form]
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2];
const form = process.argv[3];

if (!dir) {
  console.error("usage: node tests/qa/lh-inspect.mjs <reportDir> [form]");
  process.exit(1);
}

const files = readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .filter((f) => !form || f.endsWith(`-${form}.json`))
  .sort();

for (const file of files) {
  const lhr = JSON.parse(readFileSync(join(dir, file), "utf8"));
  const a = lhr.audits;
  const num = (id) => a[id]?.numericValue;
  const ms = (v) => (v == null ? "?" : Math.round(v));

  console.log(`\n########## ${file} ##########`);
  console.log(
    `perf ${Math.round((lhr.categories.performance?.score ?? 0) * 100)} | LCP ${ms(num("largest-contentful-paint"))} | TTFB ${ms(num("server-response-time"))} | FCP ${ms(num("first-contentful-paint"))} | TBT ${ms(num("total-blocking-time"))} | SI ${ms(num("speed-index"))} | CLS ${a["cumulative-layout-shift"]?.numericValue}`,
  );

  const lcpEl = a["largest-contentful-paint-element"];
  console.log(`\nLCP element: ${lcpEl?.details?.items?.[0]?.items?.[0]?.node?.snippet ?? "?"}`);
  for (const phase of lcpEl?.details?.items?.[1]?.items ?? []) {
    console.log(`  phase ${phase.phase}: ${ms(phase.timing)}ms (${ms(phase.percent)})%`);
  }

  const breaks = a["lcp-breakdown-insight"]?.details?.items ?? [];
  for (const b of breaks) {
    console.log(
      `  breakdown ${b.phase}/${b.subphase ?? ""}: ${ms(b.duration)}ms ${b.explanation ?? ""}`,
    );
  }

  console.log(`\nlong tasks: ${a["long-tasks"]?.numericValue} (total ${ms(a["long-tasks"]?.numericValue)}ms)`);
  for (const t of (a["long-tasks"]?.details?.items ?? []).slice(0, 6)) {
    console.log(
      `  ${ms(t.duration)}ms @${ms(t.startTime)} url=${(t.url || "").replace(/^https?:\/\/[^/]+/, "").slice(0, 80)}`,
    );
  }
  for (const t of (a["mainthread-work-breakdown"]?.details?.items ?? []).slice(0, 8)) {
    console.log(`  mainthread ${t.groupLabel}: ${ms(t.duration)}ms`);
  }

  const bf = a["bf-cache"]?.details?.items?.[0];
  console.log(`\nbfcache: ${bf?.notEligibleReasons?.map((r) => r.reason).join("; ") || "eligible"}`);

  console.log("\nlargest unused JS:");
  for (const i of (a["unused-javascript"]?.details?.items ?? []).slice(0, 10)) {
    console.log(
      `  ${Math.round((i.wastedBytes || 0) / 1024)}KB wasted of ${Math.round((i.totalBytes || 0) / 1024)}KB  ${(i.url || "").replace(/^https?:\/\/[^/]+/, "").slice(0, 90)}`,
    );
  }

  console.log("\nheaviest requests:");
  for (const i of [...(a["network-requests"]?.details?.items ?? [])]
    .sort((x, y) => (y.transferSize || 0) - (x.transferSize || 0))
    .slice(0, 12)) {
    console.log(
      `  ${Math.round((i.transferSize || 0) / 1024)}KB ${i.resourceType} ${(i.url || "").replace(/^https?:\/\/[^/]+/, "").slice(0, 90)}`,
    );
  }

  const diag = (a["diagnostics"]?.details?.items ?? [])[0];
  if (diag) {
    console.log(`\nrequests ${diag.numRequests}, total ${Math.round((diag.totalByteWeight || 0) / 1024)}KB`);
  }
  for (const key of ["server-response-time", "render-blocking-resources", "uses-responsive-images", "uses-optimized-images", "offscreen-images", "unminified-javascript", "legacy-javascript", "total-byte-weight", "dom-size", "bootup-time", "mainthread-work-breakdown"]) {
    const audit = a[key];
    if (!audit) continue;
    const saved = audit.details?.overallSavingsMs ?? audit.details?.overallSavingsBytes;
    if (saved) console.log(`  opportunity ${key}: ${Math.round(saved)}`);
  }
  const audits = Object.values(a)
    .filter((x) => x.details?.type === "opportunity" && x.score !== null && x.score < 0.9)
    .map((x) => ({ id: x.id, title: x.title, saving: Math.round(x.details?.overallSavingsMs ?? x.details?.overallSavingsBytes ?? 0) }));
  if (audits.length) {
    console.log("\nfailing opportunities:");
    for (const x of audits) console.log(`  ${x.id}: ${x.title} (~${x.saving})`);
  }
  const diagList = lhr.categories.performance?.auditRefs
    ?.filter((r) => r.weight > 0 && a[r.id]?.score !== null && a[r.id]?.score < 0.9)
    .map((r) => `${r.id}=${a[r.id].score}`);
  if (diagList?.length) console.log(`\nscored perf audits below 0.9: ${diagList.join(", ")}`);
}

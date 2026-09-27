/**
 * CPU/network-throttled trace of one page load, used to find what really
 * delays first paint and LCP instead of guessing from the score.
 *
 * Records a Chrome trace while loading a page under Lighthouse-like mobile
 * throttling (4x CPU slowdown, slow 4G) and reports, for the window between
 * FCP and LCP: the longest main-thread tasks with the URL/script they belong
 * to, the totals per trace category, and the image-decode / paint events.
 *
 * Usage: node tests/qa/trace-load.mjs <path> [--url base] [--cpu 4] [--tag name]
 */
import { launchChrome, openPage, sleep } from "./lib/cdp.mjs";

const args = process.argv.slice(2);
const path = args.find((a) => !a.startsWith("--")) || "/";
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
const BASE = (opt("url", process.env.QA_BASE_URL || "http://127.0.0.1:3210")).replace(
  /\/$/,
  "",
);
const CPU = Number(opt("cpu", 4));
const TAG = opt("tag", path);
/** CSS injected before first paint, used to A/B a suspected cost. */
const HIDE = opt("css", "");
const PORT = 9371;

const chrome = await launchChrome({ port: PORT });
const page = await openPage(PORT, { width: 412, height: 823 });

try {
  await page.send("Emulation.setDeviceMetricsOverride", {
    width: 412,
    height: 823,
    deviceScaleFactor: 1.75,
    mobile: true,
  });
  await page.send("Emulation.setCPUThrottlingRate", { rate: CPU });
  await page.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });
  if (HIDE) {
    await page.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `document.addEventListener("DOMContentLoaded", () => {
        const s = document.createElement("style");
        s.textContent = ${JSON.stringify(HIDE)};
        document.head.appendChild(s);
      });`,
    });
  }

  const chunks = [];
  const done = new Promise((resolve) => {
    page.on("Tracing.dataCollected", (p) => chunks.push(...p.value));
    page.on("Tracing.tracingComplete", resolve);
  });

  await page.send("Tracing.start", {
    transferMode: "ReportEvents",
    traceConfig: {
      includedCategories: [
        "devtools.timeline",
        "disabled-by-default-devtools.timeline",
        "disabled-by-default-devtools.timeline.frame",
        "blink.user_timing",
        "latencyInfo",
      ],
    },
  });

  const t0 = Date.now();
  await page.goto(`${BASE}${path}`, { waitMs: 100 });
  await page.waitFor("true", { timeout: 1 }).catch(() => {});
  // Wait until LCP stops moving (or 12s).
  let last = 0;
  for (let i = 0; i < 60; i++) {
    await sleep(200);
    const v = await page.eval(`
      return new Promise(res => {
        let best = 0;
        try {
          new PerformanceObserver(l => { for (const e of l.getEntries()) best = Math.max(best, e.startTime); }).observe({type:"largest-contentful-paint", buffered:true});
        } catch {}
        requestAnimationFrame(() => setTimeout(() => res(best), 60));
      });
    `);
    if (v > 0 && Math.abs(v - last) < 1 && i > 6) break;
    last = v;
  }
  const lcp = await page.eval(`
    return new Promise(res => {
      let best = 0, tag = "";
      try {
        new PerformanceObserver(l => { for (const e of l.getEntries()) { if (e.startTime >= best) { best = e.startTime; tag = e.element ? e.element.tagName + "." + (e.element.className||"").toString().slice(0,60) : (e.url||"").slice(0,60); } } }).observe({type:"largest-contentful-paint", buffered:true});
      } catch {}
      setTimeout(() => res({best, tag}), 200);
    });
  `);
  await page.send("Tracing.end");
  await done;
  await page.send("Emulation.setCPUThrottlingRate", { rate: 1 });

  const events = chunks
    .filter((e) => e.ph === "X" && typeof e.dur === "number")
    .map((e) => ({ ...e, ms: e.dur / 1000 }));
  const meta = chunks.find((e) => e.name === "thread_name" && e.args?.name === "CrRendererMain");
  const tid = meta?.pid !== undefined ? `${meta.pid}:${meta.tid}` : null;
  const main = events.filter((e) => tid && `${e.pid}:${e.tid}` === tid);
  const nav = main.filter((e) => e.name === "RunTask" && e.ms > 8).sort((a, b) => b.ms - a.ms);

  const byCat = new Map();
  for (const e of main) {
    const c = e.cat || "other";
    byCat.set(c, (byCat.get(c) || 0) + e.ms);
  }
  const topCats = [...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

  const lcpEvents = main.filter((e) => e.name.includes("Paint") || e.name.includes("Decode") || e.name.includes("largestContentfulPaint"));

  console.log(`\n=== ${TAG} @412x823 DPR1.75, CPU ${CPU}x, slow 4G ===`);
  if (HIDE) console.log(`injected CSS: ${HIDE}`);
  console.log(`wall clock for observation: ${Date.now() - t0}ms`);
  console.log(`reported LCP: ${Math.round(lcp.best)}ms  ${lcp.tag}`);
  const paint = await page.eval(`
    const fcp = (performance.getEntriesByType("paint") || []).find(e => e.name === "first-contentful-paint");
    return fcp ? Math.round(fcp.startTime) : -1;
  `);
  console.log(`FCP: ${paint}ms`);
  console.log(`\nmain-thread time by category (ms):`);
  for (const [c, ms] of topCats) console.log(`  ${String(Math.round(ms)).padStart(6)}  ${c}`);
  console.log(`\nlongest main-thread tasks (ms, start, name, url/script):`);
  for (const t of nav.slice(0, 22)) {
    const d = t.args?.data || {};
    const where = d.url || d.fileName || d.functionName || d.element?.nodeName || d.label || "";
    console.log(
      `  ${String(Math.round(t.ms)).padStart(5)} @${String(Math.round(t.ts / 1000)).padStart(6)}  ${t.name.padEnd(28)} ${String(where).replace(/^https?:\/\/[^/]+/, "").slice(0, 90)}`,
    );
  }
  console.log(`\npaint / decode / LCP events (ms, start, name, detail):`);
  for (const e of lcpEvents.slice(0, 40)) {
    const d = e.args?.data || {};
    const where = d.url || d.fileName || d.element?.nodeName || d.frame || "";
    console.log(
      `  ${String(Math.round(e.ms)).padStart(5)} @${String(Math.round(e.ts / 1000)).padStart(6)}  ${e.name.padEnd(28)} ${String(where).replace(/^https?:\/\/[^/]+/, "").slice(0, 80)}`,
    );
  }
  const topFrames = new Map();
  for (const e of main) {
    const f = e.args?.data?.functionName || e.args?.data?.url || e.name;
    if (!f) continue;
    const key = String(f).replace(/^https?:\/\/[^/]+/, "");
    topFrames.set(key, (topFrames.get(key) || 0) + e.ms);
  }
  console.log(`\nheaviest self-time buckets (ms):`);
  for (const [f, ms] of [...topFrames.entries()].sort((a, b) => b[1] - a[1]).slice(0, 18)) {
    console.log(`  ${String(Math.round(ms)).padStart(6)}  ${f.slice(0, 100)}`);
  }

  const base = Math.min(...main.map((e) => e.ts));
  console.log(`\nlayout / style detail (ms, startRel, name, elements, totalObjects, dirty):`);
  for (const e of main
    .filter((x) => /^(Layout|UpdateLayoutTree|Layerize|Commit|Paint|PrePaint)$/.test(x.name) && x.ms > 20)
    .sort((a, b) => b.ms - a.ms)
    .slice(0, 20)) {
    const d = e.args?.beginData || e.args?.data || {};
    console.log(
      `  ${String(Math.round(e.ms)).padStart(5)} @${String(Math.round((e.ts - base) / 1000)).padStart(6)}  ${e.name.padEnd(18)} els=${d.elementCount ?? "?"} total=${d.totalObjects ?? "?"} dirty=${(d.dirtyObjects ?? []).length || "?"} stack=${(e.args?.beginData?.stackTrace || []).slice(0, 2).map((s) => s.functionName || s.url).join(" <- ")}`,
    );
  }
  const dom = await page.eval(`
    return {
      nodes: document.querySelectorAll("*").length,
      imgs: document.images.length,
      reveals: document.querySelectorAll(".reveal-scroll").length,
      blurs: [...document.querySelectorAll("*")].filter(e => { const s = getComputedStyle(e); return (s.backdropFilter && s.backdropFilter !== "none") || (s.webkitBackdropFilter && s.webkitBackdropFilter !== "none"); }).length,
      animated: document.getAnimations ? document.getAnimations().length : -1,
    };
  `);
  console.log(`\nDOM: ${dom.nodes} nodes, ${dom.imgs} images, ${dom.reveals} reveal wrappers, ${dom.blurs} backdrop-filter elements, ${dom.animated} running animations`);
} finally {
  await page.close();
  await chrome.close();
}

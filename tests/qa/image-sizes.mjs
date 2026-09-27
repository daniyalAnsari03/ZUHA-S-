/**
 * Lists every image on a page with the `sizes` hint it was given, the width it
 * actually renders at and the candidate the browser picked, so oversized
 * `/_next/image` requests can be traced back to the exact component.
 * Read-only.
 *
 * Usage: node tests/qa/image-sizes.mjs [path] [--url base] [--w 412] [--dpr 1.75]
 */
import { launchChrome, openPage } from "./lib/cdp.mjs";

const args = process.argv.slice(2);
const path = args.find((a) => !a.startsWith("--")) || "/";
const opt = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : d;
};
const BASE = opt("url", process.env.QA_BASE_URL || "http://127.0.0.1:3210").replace(
  /\/$/,
  "",
);
const WIDTH = Number(opt("w", 412));
const DPR = Number(opt("dpr", 1.75));
const PORT = 9374;

const chrome = await launchChrome({ port: PORT });
const page = await openPage(PORT, { width: WIDTH, height: 823 });

try {
  await page.send("Emulation.setDeviceMetricsOverride", {
    width: WIDTH,
    height: 823,
    deviceScaleFactor: DPR,
    mobile: true,
  });
  await page.goto(`${BASE}${path}`, { waitMs: 2000 });
  const rows = await page.eval(`
    const out = [];
    for (const img of document.images) {
      const r = img.getBoundingClientRect();
      // currentSrc is empty until the browser actually selects a candidate;
      // falling back to \`src\` would report next/image's largest-width fallback
      // and make every lazy image look like a 1920px download.
      const picked = img.currentSrc;
      const p = new URL(picked || img.src, location.href);
      out.push({
        loaded: !!picked,
        file: decodeURIComponent(p.searchParams.get("url") || "").split("/").pop().slice(0, 30),
        w: +(p.searchParams.get("w") || 0),
        q: p.searchParams.get("q") || "",
        sizes: img.getAttribute("sizes") || "(none)",
        fill: img.hasAttribute("data-nimg-fill") || getComputedStyle(img).position === "absolute",
        renderW: Math.round(r.width),
        renderH: Math.round(r.height),
        loading: img.getAttribute("loading") || "eager",
        top: Math.round(r.top + window.scrollY),
        parent: (img.closest("article,section,a,figure")?.tagName || "") + "." + (img.closest("article,section,figure")?.className || "").toString().split(" ").slice(0,2).join("."),
      });
    }
    return out;
  `);
  const loadedRows = rows.filter((r) => r.loaded);
  console.log(`\n=== image sizing @ ${WIDTH}px dpr${DPR}: ${path} ===`);
  console.log(
    `images ${rows.length}, of which the browser has actually selected a candidate for: ${loadedRows.length} (${rows.length - loadedRows.length} still deferred below the lazy threshold)`,
  );
  console.log(
    "renderW  pick  q    loading  sizes".padEnd(46) +
      "top     file",
  );
  for (const r of loadedRows) {
    console.log(
      `${String(r.renderW).padStart(6)}x${String(r.renderH).padEnd(4)} ${String(r.w).padStart(4)} ${String(r.q).padStart(3)} ${(r.loading + "     ").slice(0, 8)} ${r.sizes.slice(0, 34).padEnd(36)} ${String(r.top).padStart(6)}  ${r.file}`,
    );
  }
  const oversize = loadedRows.filter((r) => r.w > r.renderW * DPR * 1.3 && !r.fill);
  console.log(`\npotentially oversized (picked > 1.3x the pixels needed): ${oversize.length}`);
  for (const r of oversize.slice(0, 12)) {
    console.log(
      `  renders ${r.renderW}px, picked ${r.w}px (need ~${Math.round(r.renderW * DPR)}), sizes="${r.sizes}", parent=${r.parent}`,
    );
  }
  const noSizes = loadedRows.filter((r) => r.sizes === "(none)" && !r.fill);
  console.log(`\nimages with no sizes attribute: ${noSizes.length}`);
} finally {
  await page.close();
  await chrome.close();
}

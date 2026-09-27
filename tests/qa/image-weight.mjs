/**
 * Image-weight report for a rendered page: every `/_next/image` candidate the
 * server actually emits, with its requested width/quality and real optimised
 * byte size, grouped so oversized candidates stand out. Read-only.
 *
 * Usage: node tests/qa/image-weight.mjs [path] [--url base]
 */
import { launchChrome, openPage } from "./lib/cdp.mjs";

const args = process.argv.slice(2);
const path = args.find((a) => !a.startsWith("--")) || "/";
const i = args.indexOf("--url");
const BASE = (
  i >= 0 ? args[i + 1] : process.env.QA_BASE_URL || "http://127.0.0.1:3210"
).replace(/\/$/, "");
const VIEWPORTS = [
  ["mobile", 412, 823, 1.75],
  ["tablet", 820, 1180, 2],
  ["desktop", 1440, 900, 1],
];

const chrome = await launchChrome({ port: 9373 });
const page = await openPage(9373, { width: 412, height: 823 });

try {
  for (const [form, width, height, dpr] of VIEWPORTS) {
    await page.send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: dpr,
      mobile: form !== "desktop",
    });
    await page.goto(`${BASE}${path}`, { waitMs: 2500 });
    const data = await page.eval(`
      const out = [];
      const walk = (img) => {
        const u = img.currentSrc || img.src;
        if (u && u.includes("/_next/image")) {
          const q = new URL(u);
          out.push({
            w: +(q.searchParams.get("w") || 0),
            q: q.searchParams.get("q") || "",
            file: decodeURIComponent(q.searchParams.get("url") || "").split("/").pop().slice(0, 34),
            nw: img.naturalWidth, nh: img.naturalHeight,
            cw: Math.round(img.getBoundingClientRect().width),
            ch: Math.round(img.getBoundingClientRect().height),
            alt: img.alt ? "" : "noalt",
            loading: img.getAttribute("loading") || "eager",
            top: Math.round(img.getBoundingClientRect().top + window.scrollY),
          });
        }
      };
      for (const img of document.images) walk(img);
      return {
        imgs: out,
        docBytes: document.documentElement.outerHTML.length,
        docNodes: document.querySelectorAll("*").length,
        scrollH: document.documentElement.scrollHeight,
      };
    `);
    const sized = [];
    for (const im of data.imgs) {
      const u = new URL(
        im.w
          ? `/_next/image?url=${encodeURIComponent(
              "https://geturxcylpsubnzweilc.supabase.co/storage/v1/object/public/x",
            )}&w=${im.w}&q=${im.q}`
          : "/favicon.ico",
        BASE,
      );
      void u;
    }
    // Re-measure the real optimised size for the URLs the page actually used.
    const real = await page.eval(`
      const urls = [...new Set([...document.images].map(i => i.currentSrc || i.src).filter(u => u && u.includes("/_next/image")))];
      return urls;
    `);
    let total = 0;
    const rows = [];
    for (const u of real) {
      const p = new URL(u);
      rows.push({
        w: p.searchParams.get("w"),
        q: p.searchParams.get("q"),
        file: decodeURIComponent(p.searchParams.get("url") || "").split("/").pop().slice(0, 34),
      });
      const buf = await fetch(u).then((r) => r.arrayBuffer());
      rows[rows.length - 1].kb = Math.round(buf.byteLength / 1024);
      total += rows[rows.length - 1].kb;
    }
    rows.sort((a, b) => b.kb - a.kb);
    const byCfg = new Map();
    for (const r of rows) {
      const k = `w${r.w}/q${r.q}`;
      byCfg.set(k, (byCfg.get(k) || 0) + r.kb);
    }
    const imgs = data.imgs;
    const lcpish = imgs.filter((x) => x.top < 1200);
    console.log(`\n=== ${path} @ ${form} ${width}x${height} dpr${dpr} ===`);
    console.log(
      `doc ${Math.round(data.docBytes / 1024)}KB, ${data.docNodes} nodes, page height ${data.scrollH}px, ${imgs.length} images (${lcpish.length} within the first 1200px)`,
    );
    console.log(
      `requested images: ${rows.length}, ${total}KB total | avg ${rows.length ? Math.round(total / rows.length) : 0}KB`,
    );
    for (const [k, v] of [...byCfg.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${k.padEnd(12)} ${v}KB`);
    }
    console.log("  largest:");
    for (const r of rows.slice(0, 8)) console.log(`    ${String(r.kb).padStart(4)}KB  w=${r.w} q=${r.q}  ${r.file}`);
  }
} finally {
  await page.close();
  await chrome.close();
}

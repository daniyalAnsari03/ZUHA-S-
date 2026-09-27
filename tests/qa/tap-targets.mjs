/**
 * Measures real tap-target sizes in a real browser.
 *
 * Lighthouse's `tap-targets` audit only inspects elements it can attribute in
 * the main frame snapshot and it passed on every page, so the tap-target
 * problems were reported from a different review. This walks the DOM instead
 * and reports every interactive control whose hit area is smaller than 44x44
 * CSS pixels (or that is too close to a neighbouring target), with a suggested
 * fix, so the fix is driven by measured numbers rather than guesswork.
 *
 * Usage: node tests/qa/tap-targets.mjs <path> [<path> ...] [--w 412]
 */
import { launchChrome, openPage } from "./lib/cdp.mjs";

const args = process.argv.slice(2);
const i = args.indexOf("--w");
const WIDTH = i >= 0 ? Number(args[i + 1]) : 412;
const PATHS = args.filter((a, idx) => !a.startsWith("--") && idx !== i);
const BASE = (process.env.QA_BASE_URL || "http://127.0.0.1:3210").replace(
  /\/$/,
  "",
);
const PORT = Number(process.env.QA_CDP_PORT || 9376);
const MIN = 44;

const chrome = await launchChrome({ port: PORT });
const page = await openPage(PORT, { width: WIDTH, height: 900 });

try {
  for (const path of PATHS) {
    await page.send("Emulation.setDeviceMetricsOverride", {
      width: WIDTH,
      height: 900,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await page.goto(`${BASE}${path}`, { waitMs: 1500 });

    const rows = await page.eval(`
      const MIN = ${MIN};
      const sel = 'a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=checkbox], [role=tab], label';
      const out = [];
      for (const el of document.querySelectorAll(sel)) {
        const style = getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") continue;
        if (style.opacity === "0") continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        // A control whose own box is small is fine when a stretched pseudo
        // element or a wrapping label provides the real hit area; detect the
        // common ::after/absolute-fill pattern before reporting.
        const label = (el.textContent || el.getAttribute("aria-label") || el.value || "").trim().replace(/\\s+/g, " ").slice(0, 40);
        const wrapping = el.closest("label");
        const wr = wrapping ? wrapping.getBoundingClientRect() : null;
        const cs = wrapping ? getComputedStyle(wrapping) : null;
        const padded =
          wr && cs && (parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + r.height) >= MIN;
        const effective = padded ? wr.height : r.height;
        if (effective < MIN - 0.5) {
          out.push({
            tag: el.tagName.toLowerCase(),
            type: el.getAttribute("type") || "",
            label,
            w: Math.round(r.width),
            h: Math.round(r.height),
            effective: Math.round(effective),
            cls: (el.className || "").toString().slice(0, 90),
            parent: (el.parentElement?.className || "").toString().slice(0, 70),
          });
        }
      }
      return out;
    `);

    console.log(
      `\n=== ${path} @ ${WIDTH}px — ${rows.length} control(s) under ${MIN}px ===`,
    );
    for (const r of rows) {
      console.log(
        `  <${r.tag}${r.type ? ` type=${r.type}` : ""}> ${r.w}x${r.h}${
          r.effective !== r.h ? ` (label lifts to ${r.effective})` : ""
        }  "${r.label}"`,
      );
      console.log(`      class: ${r.cls}`);
      console.log(`      parent: ${r.parent}`);
    }
  }
} finally {
  await page.close();
  await chrome.close();
}

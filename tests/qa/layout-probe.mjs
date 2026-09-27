/**
 * Layout-cost probe: finds which part of a rendered page makes a full style +
 * layout pass expensive. The homepage showed a single ~2.6s Layout trace event
 * for only ~800 DOM nodes, which is pathological, so this measures the cost of
 * a forced full relayout with candidate subtrees disabled one at a time.
 *
 * Read-only: it loads a page in a real browser and measures, it changes
 * nothing on disk or in the database.
 *
 * Usage: node tests/qa/layout-probe.mjs <path> [--url base]
 */
import { launchChrome, openPage, sleep } from "./lib/cdp.mjs";

const args = process.argv.slice(2);
const path = args.find((a) => !a.startsWith("--")) || "/";
const i = args.indexOf("--url");
const BASE = (i >= 0 ? args[i + 1] : process.env.QA_BASE_URL || "http://127.0.0.1:3210").replace(
  /\/$/,
  "",
);
const PORT = 9372;

const chrome = await launchChrome({ port: PORT });
const page = await openPage(PORT, { width: 412, height: 823 });

try {
  await page.send("Emulation.setDeviceMetricsOverride", {
    width: 412,
    height: 823,
    deviceScaleFactor: 1.75,
    mobile: true,
  });
  await page.goto(`${BASE}${path}`, { waitMs: 1500 });

  const result = await page.eval(`
    const style = document.createElement("style");
    document.head.appendChild(style);

    // Force a complete style recalc + layout of the whole tree.
    function fullPass(n) {
      const out = [];
      for (let i = 0; i < n; i++) {
        const t = performance.now();
        style.textContent = "html{--probe-" + i + ":" + i + "}";
        void document.documentElement.offsetHeight;
        out.push(performance.now() - t);
      }
      out.sort((a, b) => a - b);
      return Math.round(out[Math.floor(out.length / 2)]);
    }

    const experiments = [];
    experiments.push(["baseline", fullPass(7)]);

    const reveal = [...document.querySelectorAll(".reveal-scroll")];
    style.textContent = ".reveal-scroll{animation:none!important}";
    experiments.push(["no scroll-timeline reveal (" + reveal.length + " nodes)", fullPass(7)]);
    style.textContent = "";

    const blurred = [...document.querySelectorAll("*")].filter((el) => {
      const s = getComputedStyle(el);
      return (s.backdropFilter && s.backdropFilter !== "none") || (s.webkitBackdropFilter && s.webkitBackdropFilter !== "none");
    });
    blurred.forEach((el) => (el.style.backdropFilter = "none"));
    experiments.push(["no backdrop-filter (" + blurred.length + " nodes)", fullPass(7)]);

    const imgs = [...document.images];
    imgs.forEach((im) => im.removeAttribute("src"));
    experiments.push(["no <img> src (" + imgs.length + " images)", fullPass(7)]);

    const cards = [...document.querySelectorAll("article")];
    const cardParents = [...new Set(cards.map((c) => c.parentElement))];
    const cardHosts = cardParents.slice(0, 4);
    const saved = cardHosts.map((h) => h.innerHTML);
    cardHosts.forEach((h) => (h.style.display = "none"));
    experiments.push(["product card sections hidden (" + cards.length + " cards)", fullPass(7)]);
    cardHosts.forEach((h, n) => { h.style.display = ""; h.innerHTML = saved[n]; });

    const cats = [...document.querySelectorAll("a[href*='category=']")].slice(0, 12);
    const catHost = cats[0] && cats[0].closest("section, div");
    if (catHost) {
      const s0 = catHost.style.display;
      catHost.style.display = "none";
      experiments.push(["shop-by-category hidden", fullPass(7)]);
      catHost.style.display = s0;
    }

    const hero = document.querySelector("section img, img[fetchpriority]");
    if (hero) {
      const host = hero.closest("section") || hero.parentElement;
      const s0 = host.style.display;
      host.style.display = "none";
      experiments.push(["hero section hidden", fullPass(7)]);
      host.style.display = s0;
    }

    const anims = document.getAnimations ? document.getAnimations().length : -1;
    return {
      experiments,
      nodes: document.querySelectorAll("*").length,
      images: imgs.length,
      runningAnimations: anims,
      supportsViewTimeline: CSS.supports("animation-timeline", "view()"),
    };
  `);

  console.log(`\n=== layout probe: ${BASE}${path} @412x823 ===`);
  console.log(
    `nodes ${result.nodes}, images ${result.images}, running animations ${result.runningAnimations}, animation-timeline:view() supported: ${result.supportsViewTimeline}`,
  );
  const base = result.experiments[0][1];
  for (const [name, ms] of result.experiments) {
    console.log(
      `  ${String(ms).padStart(6)}ms  ${name}${name === "baseline" ? "" : `   (${base - ms >= 0 ? "-" : "+"}${Math.abs(base - ms)}ms vs baseline)`}`,
    );
  }
} finally {
  await page.close();
  await chrome.close();
}

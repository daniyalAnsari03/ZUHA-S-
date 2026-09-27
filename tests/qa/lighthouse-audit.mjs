/**
 * Real Lighthouse audit of the four key surfaces, run against a production
 * build (`next build` + `next start`). Reports the numbers that matter for
 * this project: LCP, TTFB, total byte weight, CLS, INP and the category
 * scores, for mobile, tablet and desktop, signed out and (for the admin
 * dashboard) signed in.
 *
 * Every pass is preceded by a cache warm-up: the document and every
 * `/_next/image` candidate the page can ask for are requested once first, so
 * the report measures the steady state a real repeat visitor gets instead of
 * a one-off cold `next/image` optimisation on a shared CPU (which added
 * multiple seconds of pure variance to LCP).
 *
 * Usage: node tests/qa/lighthouse-audit.mjs [baseUrl]
 *   LH_PAGES=homepage,category   limit the pages (default: all four)
 *   LH_FORMS=mobile              limit the form factors (default: all three)
 */
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir, homedir } from "node:os";
import { promisify } from "node:util";

import { launchChrome, openPage, sleep } from "./lib/cdp.mjs";
import "./load-env.mjs";

const exec = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const BASE = (
  process.argv[2] ||
  process.env.QA_BASE_URL ||
  "http://127.0.0.1:3210"
).replace(/\/$/, "");
const PORT = 9350;
const OUT = join(tmpdir(), `lighthouse-${Date.now()}`);
mkdirSync(OUT, { recursive: true });

/** Locate the Lighthouse CLI inside the npx cache (no global install needed). */
function lighthouseCli() {
  if (process.env.LIGHTHOUSE_CLI && existsSync(process.env.LIGHTHOUSE_CLI)) {
    return process.env.LIGHTHOUSE_CLI;
  }
  const cache = join(
    process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local"),
    "npm-cache",
    "_npx",
  );
  for (const dir of readdirSync(cache, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const cli = join(cache, dir.name, "node_modules", "lighthouse", "cli", "index.js");
    if (existsSync(cli)) return cli;
  }
  throw new Error("lighthouse CLI not found; run: npx --yes lighthouse@12 --version");
}

const PAGES = [
  { key: "homepage", url: "/", auth: false },
  { key: "category", url: "/shop?category=jamawar", auth: false },
  { key: "product", url: "/product/buta-jaal", auth: false },
  { key: "admin", url: "/admin", auth: true },
].filter((p) =>
  process.env.LH_PAGES
    ? process.env.LH_PAGES.split(",").map((s) => s.trim()).includes(p.key)
    : true,
);

/** Device classes measured on every pass: phone, tablet and desktop. */
const FORMS = [
  ["mobile", []],
  ["tablet", ["--config-path=" + join(here, "lighthouse-tablet.config.cjs")]],
  ["desktop", ["--preset=desktop"]],
].filter(([form]) =>
  process.env.LH_FORMS
    ? process.env.LH_FORMS.split(",").map((s) => s.trim()).includes(form)
    : true,
);

const CLI = lighthouseCli();

/**
 * Text that must be on the page being audited, and text that means the wrong
 * page was measured (the signed-out admin wall renders instead of redirecting,
 * so a failed sign-in used to be reported as an `admin` row).
 */
const MARKERS = {
  homepage: { ok: "DINS by Daniyal", bad: "Sign in required" },
  category: { ok: "Jamawar", bad: "Sign in required" },
  product: { ok: "Buta Jaal", bad: "Sign in required" },
  admin: { ok: "Overview", bad: "Sign in required" },
};

/** Prove the URL about to be measured really renders that surface. */
async function verifySurface(page, p) {
  await page.goto(`${BASE}${p.url}`, { waitMs: 700 });
  const text = await page.eval("return document.body.innerText || '';");
  const m = MARKERS[p.key];
  if (m.bad && text.includes(m.bad))
    throw new Error(`${p.key} rendered the signed-out wall ("${m.bad}")`);
  if (m.ok && !text.includes(m.ok))
    throw new Error(`${p.key} did not render "${m.ok}" - wrong page measured`);
  return true;
}

/**
 * Request the document and every image candidate it references, so the
 * on-disk `next/image` cache is warm before the measured pass. Without this
 * the first pass pays for on-demand image optimisation and LCP becomes a
 * measure of the optimiser's cold start rather than of the page.
 */
async function warmUp(url) {
  const res = await fetch(url, { redirect: "follow" });
  const html = await res.text();
  const candidates = new Set();
  for (const m of html.matchAll(/\/_next\/image\?[^"'\\ ]+/g)) {
    candidates.add(m[0].replace(/&amp;/g, "&"));
  }
  // A `srcset` on the same origin is also a candidate request; collect them.
  for (const m of html.matchAll(/srcset="([^"]+)"/g)) {
    for (const part of m[1].split(",")) {
      const u = part.trim().split(/\s+/)[0];
      if (u?.startsWith("/_next/image")) candidates.add(u.replace(/&amp;/g, "&"));
    }
  }
  let done = 0;
  for (const c of candidates) {
    try {
      await fetch(new URL(c, url).toString(), { method: "GET" });
      done++;
    } catch {
      /* a candidate that cannot be warmed is simply measured cold */
    }
  }
  return { html: html.length, images: done };
}

const run = async (label, file, extra = []) => {
  const args = [
    CLI,
    `${BASE}${PAGES.find((p) => p.key === label).url}`,
    "--port=" + PORT,
    "--output=json",
    "--output-path=" + file,
    "--only-categories=performance,accessibility,best-practices,seo",
    "--quiet",
    ...extra,
  ];
  process.stdout.write(`  running lighthouse (${label}${extra.length ? " " + extra.join(" ") : ""})... `);
  await exec(process.execPath, args, { maxBuffer: 1024 * 1024 * 64, timeout: 600000 });
  console.log("done");
};

function summarize(lhr) {
  const a = lhr.audits;
  const num = (id) => a[id]?.numericValue;
  const totalBytes = (a["total-byte-weight"]?.details?.items || []).reduce(
    (sum, i) => sum + (i.size || 0),
    0,
  );
  return {
    perf: Math.round((lhr.categories.performance?.score ?? 0) * 100),
    a11y: Math.round((lhr.categories.accessibility?.score ?? 0) * 100),
    bp: Math.round((lhr.categories["best-practices"]?.score ?? 0) * 100),
    seo: Math.round((lhr.categories.seo?.score ?? 0) * 100),
    lcp: Math.round(num("largest-contentful-paint")),
    ttfb: Math.round(num("server-response-time")),
    fcp: Math.round(num("first-contentful-paint")),
    cls: a["cumulative-layout-shift"]?.numericValue?.toFixed(3),
    tbt: Math.round(num("total-blocking-time")),
    si: Math.round(num("speed-index")),
    bytes: Math.round(totalBytes / 1024),
    requests: a["network-requests"]?.details?.items?.length ?? null,
    transfer: Math.round(
      ((a["total-byte-weight"]?.numericValue ?? 0) / 1024),
    ),
    docBytes: Math.round(
      (a["network-requests"]?.details?.items?.find((i) => i.resourceType === "Document")
        ?.transferSize ??
        0) / 1024,
    ),
    jsBytes: Math.round(
      (a["network-requests"]?.details?.items
        ?.filter((i) => i.resourceType === "Script")
        .reduce((s, i) => s + (i.transferSize || 0), 0) ?? 0) / 1024,
    ),
    imgBytes: Math.round(
      (a["network-requests"]?.details?.items
        ?.filter((i) => i.resourceType === "Image")
        .reduce((s, i) => s + (i.transferSize || 0), 0) ?? 0) / 1024,
    ),
    lcpEl: a["largest-contentful-paint-element"]?.details?.items?.[0]?.items?.[0]
      ?.node?.snippet,
    longTask: Math.round(
      Math.max(
        0,
        ...(a["long-tasks"]?.details?.items ?? []).map((i) => i.duration || 0),
      ),
    ),
    bfcache:
      a["bf-cache"]?.details?.items?.[0]?.notEligibleReasons
        ?.map((r) => r.reason)
        .join("; ") || "eligible",
  };
}

/**
 * Sign in through the real login form and prove a session exists.
 *
 * Typing before the form is interactive is a silent no-op: the click then
 * submits empty credentials, nothing navigates, and the audit goes on to
 * measure the signed-out "Sign in required" wall while labelling the row
 * `admin`. So this retries, verifies the session cookie, and throws instead
 * of returning a number that does not describe the page it claims to.
 */
async function signInAdmin(page) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    await page.goto(`${BASE}/login`, { waitMs: 0 });
    const laidOut = await page.waitFor(
      `!!document.querySelector("#email") && !!document.querySelector("#password") && !!document.querySelector('button[type="submit"]')`,
      { timeout: 20000, poll: 50 },
    );
    if (!laidOut) continue;
    await sleep(700);
    await page.type("#email", process.env.ADMIN_EMAIL);
    await page.type("#password", process.env.ADMIN_PASSWORD);
    const filled = await page.eval(`return document.querySelector("#email").value === ${JSON.stringify(
      process.env.ADMIN_EMAIL,
    )} && document.querySelector("#password").value.length > 0;`);
    if (!filled) continue;
    await page.clickSelector('button[type="submit"]');
    const navigated = await page.waitFor(`location.pathname !== "/login"`, {
      timeout: 30000,
      poll: 100,
    });
    const cookie = (await page.cookies()).find((c) =>
      c.name.includes("auth-token"),
    );
    if (navigated && cookie) {
      await sleep(1000);
      return true;
    }
    console.log(`  admin sign-in attempt ${attempt} did not produce a session; retrying`);
  }
  throw new Error(
    "admin sign-in failed after 3 attempts - refusing to audit the signed-out admin wall",
  );
}

const rows = [];
const chrome = await launchChrome({ port: PORT });
const page = await openPage(PORT, { width: 1440, height: 900 });

try {
  for (const p of PAGES) {
    if (p.auth) {
      await signInAdmin(page);
      console.log("signed in for admin audit: true");
    }
    for (const [form, extra] of FORMS) {
      const file = join(OUT, `${p.key}-${form}.json`);
      await verifySurface(page, p);
      const warm = await warmUp(`${BASE}${p.url}`);
      process.stdout.write(
        `  warm-up ${p.key}/${form}: ${warm.images} image candidates cached... `,
      );
      await run(p.key, file, extra);
      rows.push({ page: p.key, form, ...summarize(JSON.parse(readFileSync(file, "utf8"))) });
    }
  }
} finally {
  await page.close();
  await chrome.close();
}

const pad = (s, n) => String(s).padEnd(n);
console.log("\n=== Lighthouse 12.8.2 (production build, next start) ===");
console.log(
  `${pad("page", 10)}${pad("form", 9)}${pad("perf", 6)}${pad("a11y", 6)}${pad("BP", 5)}${pad("SEO", 5)}${pad("LCP", 7)}${pad("TTFB", 7)}${pad("FCP", 7)}${pad("CLS", 7)}${pad("TBT", 6)}${pad("long", 6)}${pad("total KB", 10)}${pad("reqs", 6)}${pad("doc KB", 8)}${pad("js KB", 8)}${pad("img KB", 8)}`,
);
for (const r of rows) {
  console.log(
    pad(r.page, 10) +
      pad(r.form, 9) +
      pad(r.perf, 6) +
      pad(r.a11y, 6) +
      pad(r.bp, 5) +
      pad(r.seo, 5) +
      pad(r.lcp, 7) +
      pad(r.ttfb, 7) +
      pad(r.fcp, 7) +
      pad(r.cls, 7) +
      pad(r.tbt, 6) +
      pad(r.longTask, 6) +
      pad(r.transfer, 10) +
      pad(r.requests, 6) +
      pad(r.docBytes, 8) +
      pad(r.jsBytes, 8) +
      pad(r.imgBytes, 8),
  );
}
console.log("\nLCP elements / bfcache:");
for (const r of rows) {
  console.log(
    `  ${r.page}/${r.form}: LCP=${(r.lcpEl ?? "?").replace(/<[^>]*>/g, "").slice(0, 90)} | bfcache=${r.bfcache}`,
  );
}
console.log(`\nraw reports: ${OUT}`);

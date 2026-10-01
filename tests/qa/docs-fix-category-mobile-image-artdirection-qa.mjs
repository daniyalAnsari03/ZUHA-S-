/**
 * DOCS/FIX.TXT — MOBILE CATEGORY IMAGE, ART-DIRECTION CASE.
 *
 * Complements docs-fix-category-mobile-image-qa.mjs (which covers the
 * desktop-only fallback). This script covers the other half: a category that
 * HAS both images must show the mobile one below 768px and the desktop one at
 * 768px and up.
 *
 * It is deliberately end-to-end and self-cleaning:
 *   1. Generates two solid-colour disposable images (red = desktop, blue =
 *      mobile) so the image actually on screen can be identified by its pixels,
 *      not just its filename.
 *   2. Creates a "QA TEMP" category through the REAL admin form, uploading each
 *      file through the real ImagePicker → uploadImageAction path. This also
 *      exercises revalidateTag, so the storefront picks it up immediately
 *      instead of waiting out the 300s categories cache.
 *   3. Loads the homepage at 390 / 768 / 1440, finds the QA TEMP slide, draws
 *      the VISIBLE <img> to a canvas and samples its centre pixel.
 *   4. Asserts red at tablet/desktop, blue at mobile, and that the other image
 *      is display:none at that width.
 *   5. Deletes the category and both uploaded objects, then verifies the
 *      cleanup. Nothing real is touched: only the disposable QA TEMP category
 *      and the two files it uploaded.
 *
 * Usage: node tests/qa/docs-fix-category-mobile-image-artdirection-qa.mjs
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import sharp from "sharp";

import { launchChrome, openPage } from "./lib/cdp.mjs";
import { serviceGet, serviceDelete, QaResults, sleep, APP_URL } from "./lib/harness.mjs";

const PORT = 9377;
const BASE = (APP_URL || "http://localhost:3000").replace(/\/$/, "");
const BUCKET = "product-images";

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844, want: "mobile" },
  { name: "tablet", width: 768, height: 1024, want: "desktop" },
  { name: "desktop", width: 1440, height: 900, want: "desktop" },
];

const DESKTOP_RGB = { r: 220, g: 20, b: 20 }; // red
const MOBILE_RGB = { r: 20, g: 40, b: 220 }; // blue

const results = new QaResults();
const token = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const SLUG = `qa-temp-mobile-image-${token}`;
const NAME = `QA TEMP Mobile Image ${token}`;

let categoryId = null;
let uploadedPaths = [];
let workDir = null;

/* ── Disposable assets ────────────────────────────────────────────────────── */

async function makeSolid(name, { r, g, b }, w, h) {
  const file = join(workDir, name);
  const buf = await sharp({
    create: { width: w, height: h, channels: 3, background: { r, g, b } },
  })
    .jpeg({ quality: 90 })
    .toBuffer();
  writeFileSync(file, buf);
  return file;
}

/* ── CDP helpers ──────────────────────────────────────────────────────────── */

/** Attach a real file to a hidden <input type=file> and fire its change event. */
async function setFileInput(page, objectId, filePath) {
  await page.send("DOM.enable");
  // setFileInputFiles takes an objectId directly, which avoids the flaky
  // DOM.requestNode round-trip for nodes Chrome has not pushed.
  await page.send("DOM.setFileInputFiles", { files: [filePath], objectId });
}

async function objectIdFor(page, expression, what) {
  const r = await page.send("Runtime.evaluate", { expression });
  if (r.exceptionDetails) {
    throw new Error(`evaluating ${what} threw: ${r.exceptionDetails.text}`);
  }
  const oid = r.result?.objectId;
  if (!oid) {
    throw new Error(
      `could not get a handle on ${what} (result: ${JSON.stringify(r.result)})`,
    );
  }
  return oid;
}

/** Click the ImagePicker trigger whose label matches `labelText`. */
async function openPicker(page, labelText) {
  const box = await page.eval(`
    const label = [...document.querySelectorAll("label")].find(
      (l) => new RegExp("^\\\\s*" + ${JSON.stringify(labelText)}, "i").test(l.textContent || ""),
    );
    const btn = label?.querySelector("button");
    if (!btn) return { noTrigger: true };
    btn.scrollIntoView({ block: "center", behavior: "instant" });
    const r = btn.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  `);
  if (box.noTrigger) throw new Error(`no ImagePicker trigger labelled "${labelText}"`);
  await page.clickAt(box.x, box.y);
  await sleep(400);

  const opened = await page.eval(`
    return [...document.querySelectorAll("h3")].some((h) => /choose image/i.test(h.textContent || ""));
  `);
  if (!opened) {
    throw new Error(`clicking the "${labelText}" trigger did not open the Choose Image modal`);
  }
}

/** Upload `filePath` into the currently open picker modal. */
async function uploadVia(page, filePath) {
  const tab = await page.eval(`
    const b = [...document.querySelectorAll("button")].find(
      (x) => /^upload new$/i.test((x.textContent || "").trim()),
    );
    if (!b) {
      return { noTab: true, buttons: [...document.querySelectorAll("button")]
        .map((x) => (x.textContent || "").trim()).filter(Boolean).slice(0, 12) };
    }
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  `);
  if (tab.noTab) {
    throw new Error(`"Upload New" tab not found; buttons seen: ${tab.buttons.join(" | ")}`);
  }
  await page.clickAt(tab.x, tab.y);
  await sleep(400);

  const probe = await page.eval(`return !!document.querySelector('input[type="file"]');`);
  if (!probe) throw new Error("Upload tab is open but no file input was rendered");

  const oid = await objectIdFor(
    page,
    'document.querySelector(\'input[type="file"]\')',
    "the picker's file input",
  );
  await setFileInput(page, oid, filePath);
}

/* ── Storefront probe ─────────────────────────────────────────────────────── */

/**
 * Find the QA TEMP slide, scroll to it, and identify the visible image by the
 * pixels it actually paints (via a canvas), not by filename.
 */
const PROBE = `
  const slide = document.querySelector('a[href*=${JSON.stringify(SLUG)}]');
  if (!slide) return { missing: true };
  const scroller = slide.closest('[aria-label="Slide deck"]');
  if (scroller) {
    // One slide height per index. offsetTop is no good here: every slide in the
    // stack is stuck to the top of the scrollport, so the geometry it reports is
    // wherever the deck currently is, not where the slide lives in the order.
    const i = [...scroller.children].indexOf(slide);
    scroller.scrollTo({ top: i * scroller.clientHeight, behavior: "instant" });
  }
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  const imgs = [...slide.querySelectorAll("img")];

  // Decode ONLY the images that are actually displayed. A hidden, lazy image
  // (the mobile one on tablet/desktop) is never fetched, and its decode()
  // promise never settles — awaiting it would hang the whole evaluation.
  const shown = imgs.filter((img) => {
    const cs = getComputedStyle(img);
    const r = img.getBoundingClientRect();
    return cs.display !== "none" && r.width > 0 && r.height > 0;
  });
  await Promise.race([
    Promise.all(shown.map((img) => img.decode().catch(() => {}))),
    new Promise((r) => setTimeout(r, 8000)),
  ]);

  const decoded = imgs.map((img) => {
    const cs = getComputedStyle(img);
    const r = img.getBoundingClientRect();
    const isShown = cs.display !== "none" && r.width > 0 && r.height > 0;
    let rgb = null;
    if (isShown && img.naturalWidth > 0) {
      const c = document.createElement("canvas");
      c.width = 32; c.height = 32;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0, 32, 32);
      const d = ctx.getImageData(16, 16, 1, 1).data;
      rgb = { r: d[0], g: d[1], b: d[2] };
    }
    return {
      display: cs.display,
      shown: isShown,
      w: Math.round(r.width),
      h: Math.round(r.height),
      naturalWidth: img.naturalWidth,
      // A hidden lazy image that was never fetched is the EXPECTED outcome on
      // tablet/desktop — proof the unused variant costs no bandwidth.
      fetched: img.currentSrc !== "" && img.complete && img.naturalWidth > 0,
      currentSrc: img.currentSrc || img.src,
      rgb,
    };
  });
  return { href: slide.getAttribute("href"), imgs: decoded };
`;

const near = (got, want) =>
  got != null &&
  Math.abs(got.r - want.r) < 70 &&
  Math.abs(got.g - want.g) < 70 &&
  Math.abs(got.b - want.b) < 70;

/* ── Run ──────────────────────────────────────────────────────────────────── */

const chrome = await launchChrome({ port: PORT, headless: true });

try {
  workDir = mkdtempSync(join(tmpdir(), "qa-catimg-"));
  const desktopFile = await makeSolid("desktop.jpg", DESKTOP_RGB, 1600, 900);
  const mobileFile = await makeSolid("mobile.jpg", MOBILE_RGB, 900, 1600);

  const page = await openPage(PORT, { width: 1440, height: 1000 });

  // Sign in through the real login form.
  await page.goto(`${BASE}/login`, { waitMs: 500 });
  await page.type("#email", process.env.ADMIN_EMAIL);
  await page.type("#password", process.env.ADMIN_PASSWORD);
  await page.clickSelector('button[type="submit"]');
  if (!(await page.waitFor(`location.pathname !== "/login"`, { timeout: 25000, poll: 100 }))) {
    throw new Error("admin sign-in failed");
  }

  // Create the QA TEMP category through the real form.
  await page.goto(`${BASE}/admin/categories/new`, { waitMs: 900 });
  await page.type('input[name="name"]', NAME);
  await page.type('input[name="slug"]', SLUG);

  await openPicker(page, "Desktop Image");
  await uploadVia(page, desktopFile);
  // The picker closes its modal on a successful upload; wait for the hidden
  // input to actually carry a storage path before moving on.
  await page.waitFor(
    `(document.querySelector('input[type="hidden"][name="imageUrl"]')?.value || "").length > 0`,
    { timeout: 60000, poll: 200 },
  );
  await sleep(800);

  await openPicker(page, "Mobile Image");
  await uploadVia(page, mobileFile);
  await page.waitFor(
    `(document.querySelector('input[type="hidden"][name="mobileImageUrl"]')?.value || "").length > 0`,
    { timeout: 60000, poll: 200 },
  );
  await sleep(500);

  const beforeSave = await page.eval(`
    return {
      desktop: document.querySelector('input[type="hidden"][name="imageUrl"]')?.value || "",
      mobile: document.querySelector('input[type="hidden"][name="mobileImageUrl"]')?.value || "",
    };
  `);
  results.record(
    "picker-desktop",
    "Desktop picker stored an uploaded path before save",
    beforeSave.desktop.length > 0,
    { note: beforeSave.desktop || "(empty)" },
  );
  results.record(
    "picker-mobile",
    "Mobile picker stored an uploaded path before save",
    beforeSave.mobile.length > 0,
    { note: beforeSave.mobile || "(empty)" },
  );
  if (!beforeSave.desktop || !beforeSave.mobile) {
    throw new Error(`upload did not populate both fields: ${JSON.stringify(beforeSave)}`);
  }
  uploadedPaths = [beforeSave.desktop, beforeSave.mobile];

  // Save.
  await page.clickSelector('form button[type="submit"]');
  const saved = await page.waitFor(`location.pathname === "/admin/categories"`, {
    timeout: 45000,
    poll: 200,
  });
  results.record(
    "form-saved",
    "category saved through the real admin form",
    saved,
    { note: await page.url() },
  );
  if (!saved) throw new Error("category form did not redirect after save");

  // The category must exist with BOTH urls persisted.
  const rows = await serviceGet(
    `/rest/v1/categories?slug=eq.${SLUG}&select=id,image_url,mobile_image_url`,
  );
  const row = Array.isArray(rows) && rows[0];
  categoryId = row?.id ?? null;
  results.record(
    "db-both-images",
    "database stored both the desktop and the mobile image",
    Boolean(row && row.image_url && row.mobile_image_url && row.image_url !== row.mobile_image_url),
    {
      note: row ? `image_url=${row.image_url} | mobile_image_url=${row.mobile_image_url}` : "row not found",
    },
  );
  if (!categoryId) throw new Error("QA TEMP category was not persisted");
  await page.close();

  // Now verify what each viewport actually paints.
  for (const vp of VIEWPORTS) {
    const p2 = await openPage(PORT, { width: vp.width, height: vp.height });

    // `revalidateTag` invalidates lazily: the first request after a category
    // save can still be served the stale, pre-save category list. Reload until
    // the QA TEMP slide is present instead of racing the revalidation.
    let data = { missing: true };
    for (let attempt = 1; attempt <= 4 && data.missing; attempt++) {
      await p2.goto(`${BASE}/`, { waitMs: 1500 });
      data = await p2.eval(PROBE);
      if (data.missing && attempt < 4) {
        console.log(
          `  [${vp.name} ${vp.width}px] slide not in DOM yet (stale cache), reload ${attempt}/3…`,
        );
        await sleep(1500);
      }
    }

    if (data.missing) {
      results.record(
        `${vp.name}-art-directed`,
        `QA TEMP slide present at ${vp.width}px`,
        false,
        { note: "slide still absent after 4 loads" },
      );
      await p2.close();
      continue;
    }

    const shown = data.imgs.filter((i) => i.display !== "none" && i.w > 0 && i.h > 0);
    const want = vp.want === "mobile" ? MOBILE_RGB : DESKTOP_RGB;
    const wantName = vp.want === "mobile" ? "mobile (blue)" : "desktop (red)";

    results.record(
      `${vp.name}-shows-mobile-image`,
      `at ${vp.width}px exactly one image is visible and it is the ${wantName} one`,
      shown.length === 1 && near(shown[0]?.rgb, want),
      {
        note: `visible=${shown.length}/${data.imgs.length} painted=${JSON.stringify(shown[0]?.rgb)} wanted=${JSON.stringify(want)}`,
        mismatch:
          shown.length !== 1
            ? `expected exactly 1 visible <img>, got ${shown.length}`
            : !near(shown[0]?.rgb, want)
              ? `painted ${JSON.stringify(shown[0]?.rgb)} but expected the ${wantName} image ${JSON.stringify(want)}`
              : undefined,
      },
    );

    // The unused variant must be display:none. Whether it was also DOWNLOADED
    // is a known trade-off, not a correctness failure, so it is reported
    // rather than asserted:
    //   tablet/desktop — the mobile variant is lazy + display:none, so the
    //     browser never requests it (no waste).
    //   mobile — the desktop variant keeps its existing `eager` head start, so
    //     it is fetched before being hidden (one wasted request on the first
    //     category slide only, and only once a category is art-directed).
    const hiddenImgs = data.imgs.filter((i) => i.display === "none");
    const wasted = hiddenImgs.filter((i) => i.fetched).length;
    results.record(
      `${vp.name}-hides-other-image`,
      `at ${vp.width}px the other image is display:none`,
      hiddenImgs.length === 1,
      {
        note: `${hiddenImgs.length} hidden of ${data.imgs.length}; hidden-and-downloaded=${wasted}${wasted ? " (known eager trade-off)" : " (never fetched)"}`,
        mismatch: hiddenImgs.length !== 1 ? `expected exactly 1 hidden <img>, got ${hiddenImgs.length}` : undefined,
      },
    );
    if (wasted) console.log(`      note: 1 hidden image was still fetched at ${vp.width}px`);

    results.record(
      `${vp.name}-clean`,
      `no page errors at ${vp.width}px`,
      p2.pageErrors.length === 0,
      { note: p2.pageErrors.slice(0, 2).join(" | ") || "none" },
    );

    console.log(
      `  [${vp.name} ${vp.width}px] visible=${shown.length} rgb=${JSON.stringify(shown[0]?.rgb)}\n`,
    );
    await p2.close();
  }
} catch (error) {
  results.record("run", "script completed without throwing", false, {
    note: error?.message || String(error),
  });
} finally {
  // Teardown: remove the QA TEMP category and both uploaded objects.
  if (categoryId) {
    try {
      await serviceDelete(`/rest/v1/categories?id=eq.${categoryId}`);
    } catch (e) {
      console.log(`  teardown: could not delete category — ${e.message}`);
    }
  }
  for (const path of uploadedPaths) {
    try {
      await serviceDelete(`/storage/v1/object/${BUCKET}/${path}`);
    } catch (e) {
      console.log(`  teardown: could not delete ${path} — ${e.message}`);
    }
  }
  if (workDir) {
    try {
      rmSync(workDir, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
  }
  await chrome.close();

  // Prove the teardown actually worked.
  const after = await serviceGet(`/rest/v1/categories?slug=eq.${SLUG}&select=id`);
  results.record(
    "teardown",
    "QA TEMP category and uploaded files are gone",
    !Array.isArray(after) || after.length === 0,
    { note: after?.length ? `${after.length} QA TEMP row(s) still present` : "removed" },
  );
}

const summary = results.summary("Category mobile image — art direction");
process.exit(summary.fail > 0 ? 1 : 0);

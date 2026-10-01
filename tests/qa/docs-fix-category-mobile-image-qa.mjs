/**
 * DOCS/FIX.TXT — MOBILE CATEGORY IMAGE (homepage slides).
 *
 * Verifies the responsive image source on the full-bleed homepage category
 * slides (components/storefront/home-slides.tsx) in a real browser at three
 * viewports, using the same boundary the component uses: Tailwind `md` (768px).
 *
 * What this locks in:
 *   1. FALLBACK — a category with only a desktop image shows that image on
 *      mobile, tablet and desktop. It must never render a blank slide.
 *   2. ART DIRECTION — a category with BOTH images shows the mobile image
 *      below 768px and the desktop image at/above it. Exactly one of the two
 *      is visible at any width.
 *   3. NO REGRESSION — a non-art-directed category still renders exactly one
 *      <img> (no duplicate node, no extra request), and the slide stays
 *      full-bleed, object-cover, and clickable through to the category page.
 *
 * Read-only against the storefront plus a live read of the categories table, so
 * it never mutates catalog data. Categories that have a mobile_image_url set
 * are auto-detected, so the script works before and after the migration is
 * applied.
 *
 * Usage: node tests/qa/docs-fix-category-mobile-image-qa.mjs
 */
import { launchChrome, openPage } from "./lib/cdp.mjs";
import { serviceGet, QaResults, sleep, APP_URL } from "./lib/harness.mjs";

const PORT = 9345;
const BASE = APP_URL || "http://127.0.0.1:3000";

// Matches Tailwind's `md`, the boundary the component switches on.
const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844, expect: "mobile" },
  { name: "tablet", width: 768, height: 1024, expect: "desktop" },
  { name: "desktop", width: 1440, height: 900, expect: "desktop" },
];

const results = new QaResults();

/**
 * Which categories actually carry a mobile image right now.
 * Tolerates the column not existing yet (migration 00024 unapplied) so the
 * script still verifies the fallback path in that state.
 */
async function readCategories() {
  const base = "/rest/v1/categories?is_active=eq.true&order=sort_order&select=";
  try {
    const rows = await serviceGet(`${base}slug,name,image_url,mobile_image_url`);
    return Array.isArray(rows) ? rows : [];
  } catch {
    const rows = await serviceGet(`${base}slug,name,image_url`);
    console.log(
      "Note: categories.mobile_image_url does not exist yet — migration 00024 is unapplied.\n",
    );
    return (Array.isArray(rows) ? rows : []).map((c) => ({
      ...c,
      mobile_image_url: null,
    }));
  }
}

/**
 * Read every <img> inside the first category slide, with the layout facts that
 * decide what a user actually sees. `visible` is computed from real computed
 * style + box size, not from class names.
 */
const PROBE = `
  const section = document.querySelector('section[aria-label="Featured"]');
  const scroller = section?.querySelector(":scope > div");
  const slide = document.querySelector('section[aria-label="Featured"] a[href*="/shop?category="]');
  if (!slide) return { missing: true };
  const imgs = [...slide.querySelectorAll("img")];
  const rect = (el) => { const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; };
  return {
    href: slide.getAttribute("href"),
    box: rect(slide),
    // Full-bleed means "exactly fills the slide stack", not "exactly the
    // requested viewport width" — the page scrollbar makes those differ.
    scrollerBox: scroller ? rect(scroller) : null,
    imgs: imgs.map((img) => {
      const cs = getComputedStyle(img);
      const r = img.getBoundingClientRect();
      return {
        display: cs.display,
        objectFit: cs.objectFit,
        objectPosition: cs.objectPosition,
        w: Math.round(r.width),
        h: Math.round(r.height),
        loading: img.getAttribute("loading"),
        // currentSrc is the variant the browser actually chose after srcset.
        currentSrc: img.currentSrc || img.src,
        // Decoded, painted pixels — proves the slide is not blank.
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        complete: img.complete,
      };
    }),
  };
`;

const visible = (img) => img.display !== "none" && img.w > 0 && img.h > 0;

const short = (url) => {
  if (!url) return "(none)";
  try {
    const u = new URL(url);
    const raw = u.searchParams.get("url") || decodeURIComponent(u.pathname);
    return decodeURIComponent(raw).split("/").pop() || raw;
  } catch {
    return url.slice(-70);
  }
};

const chrome = await launchChrome({ port: PORT, headless: true });
let failed = false;

try {
  const categories = await readCategories();
  const artDirected = categories.filter(
    (c) => c.mobile_image_url && c.mobile_image_url !== c.image_url,
  );
  const fallbackOnly = categories.filter(
    (c) => !c.mobile_image_url || c.mobile_image_url === c.image_url,
  );

  console.log(
    `Categories: ${categories.length} total | ${artDirected.length} art-directed | ${fallbackOnly.length} desktop-only\n`,
  );

  for (const vp of VIEWPORTS) {
    const page = await openPage(PORT, { width: vp.width, height: vp.height });

    await page.goto(`${BASE}/`, { waitMs: 1200 });
    // Scroll the slide stack to the first category slide (the hero owns
    // slide 0) and let the image decode.
    //
    // Positioned by index, not by offsetTop: every slide in the stack is pinned
    // to the top of the scrollport, so its geometry reports wherever the deck
    // currently is rather than where the slide sits in the order.
    await page.eval(`
      const scroller = document.querySelector('section[aria-label="Featured"] > div');
      const slide = document.querySelector('section[aria-label="Featured"] a[href*="/shop?category="]');
      if (scroller && slide) {
        const i = [...scroller.children].indexOf(slide);
        scroller.scrollTo({ top: i * scroller.clientHeight, behavior: "instant" });
      }
      const img = slide?.querySelector("img");
      if (img) { try { await img.decode(); } catch {} }
      return true;
    `);
    await sleep(400);

    const data = await page.eval(PROBE);

    if (data.missing) {
      results.record(
        `${vp.name}-probe`,
        `category slide present at ${vp.width}px`,
        false,
        { note: "no category slide found in the DOM" },
      );
      failed = true;
      await page.close();
      continue;
    }

    const shown = data.imgs.filter(visible);

    // A slide must never be blank: something visible, with real pixels.
    results.record(
      `${vp.name}-not-blank`,
      `slide renders a visible, decoded image at ${vp.width}px`,
      shown.length === 1 && shown[0].naturalWidth > 0,
      {
        note: `visible=${shown.length} total=${data.imgs.length} natural=${shown
          .map((i) => `${i.naturalWidth}x${i.naturalHeight}`)
          .join(",")}`,
        mismatch: shown.length !== 1
          ? `expected exactly 1 visible img, got ${shown.length}`
          : shown[0]?.naturalWidth === 0
            ? "visible img decoded to 0px wide (blank slide)"
            : undefined,
      },
    );

    if (!shown.length) failed = true;

    // Full-bleed + object-cover must survive the change.
    const bleeds =
      data.scrollerBox != null &&
      Math.abs(data.box.w - data.scrollerBox.w) <= 1 &&
      Math.abs(data.box.h - data.scrollerBox.h) <= 1;
    results.record(
      `${vp.name}-fullbleed`,
      `slide stays full-bleed object-cover object-center at ${vp.width}px`,
      bleeds &&
        shown[0]?.objectFit === "cover" &&
        shown[0]?.objectPosition === "50% 50%",
      {
        note: `slide=${data.box.w}x${data.box.h} stack=${data.scrollerBox?.w}x${data.scrollerBox?.h} fit=${shown[0]?.objectFit} pos=${shown[0]?.objectPosition}`,
        mismatch: !bleeds
          ? `slide ${data.box.w}x${data.box.h} does not fill the stack ${data.scrollerBox?.w}x${data.scrollerBox?.h}`
          : undefined,
      },
    );
    if (!bleeds) failed = true;

    // Art direction: the first art-directed category must show the right one.
    if (artDirected.length) {
      const target = artDirected[0];
      const want = vp.expect === "mobile" ? target.mobile_image_url : target.image_url;
      const got = short(shown[0]?.currentSrc || "");
      const wantShort = short(want);
      const encoded = decodeURIComponent(want || "").split("/").pop();
      const pass = got.includes(encoded) || got.includes(wantShort);
      results.record(
        `${vp.name}-art-directed`,
        `art-directed category "${target.slug}" shows the ${
          vp.expect === "mobile" ? "mobile" : "desktop"
        } image at ${vp.width}px`,
        pass,
        {
          note: `visible=${got} | want=${wantShort} | hidden=${data.imgs
            .filter((i) => !visible(i))
            .map((i) => short(i.currentSrc))
            .join(",")}`,
          mismatch: pass ? undefined : `expected "${wantShort}", saw "${got}"`,
        },
      );
      if (!pass) failed = true;
    } else {
      console.log(
        `  [${vp.name} ${vp.width}px] art-direction check SKIPPED — no category has a distinct mobile_image_url yet.`,
      );
      console.log(
        "      Apply supabase/migrations/00024_categories_mobile_image.sql, set a Mobile Image in",
      );
      console.log(
        "      Admin > Categories, then re-run this script for the art-direction assertions.",
      );
    }

    // Fallback: the first desktop-only category must show its desktop image
    // everywhere, and must not carry a duplicate <img>.
    if (fallbackOnly.length) {
      const target = fallbackOnly[0];
      const encoded = decodeURIComponent(target.image_url || "").split("/").pop();
      const got = short(shown[0]?.currentSrc || "");
      const pass = got.includes(encoded) && data.imgs.length === 1;
      results.record(
        `${vp.name}-fallback`,
        `desktop-only category "${target.slug}" falls back to its desktop image at ${vp.width}px`,
        pass,
        {
          note: `visible=${got} | imgNodes=${data.imgs.length} (expected 1)`,
          mismatch: pass
            ? undefined
            : !got.includes(encoded)
              ? `expected fallback to "${encoded}", saw "${got}"`
              : `rendered ${data.imgs.length} <img> nodes, expected 1 (no art direction set)`,
        },
      );
      if (!pass) failed = true;
    }

    // The slide must still navigate to the category page.
    results.record(
      `${vp.name}-link`,
      `slide still links to the category page at ${vp.width}px`,
      /\/shop\?category=/.test(data.href || ""),
      { note: data.href },
    );

    results.record(
      `${vp.name}-clean`,
      `no page/console errors at ${vp.width}px`,
      page.pageErrors.length === 0,
      { note: page.pageErrors.slice(0, 3).join(" | ") || "none" },
    );
    if (page.pageErrors.length) failed = true;

    console.log(
      `  [${vp.name} ${vp.width}px] imgs=${data.imgs.length} visible=${shown.length} → ${short(
        shown[0]?.currentSrc || "",
      )}\n`,
    );

    await page.close();
  }

  /* ── Admin category form: both pickers must be present and wired ──────── */

  if (categories.length) {
    const page = await openPage(PORT, { width: 1440, height: 1000 });

    // Sign in through the real login form, not an injected cookie.
    await page.goto(`${BASE}/login`, { waitMs: 400 });
    await page.type("#email", process.env.ADMIN_EMAIL);
    await page.type("#password", process.env.ADMIN_PASSWORD);
    await page.clickSelector('button[type="submit"]');
    const signedIn = await page.waitFor(`location.pathname !== "/login"`, {
      timeout: 25000,
      poll: 100,
    });
    if (!signedIn) throw new Error("admin sign-in failed");

    await page.goto(`${BASE}/admin/categories`, { waitMs: 600 });
    const rowHref = await page.eval(`
      const a = document.querySelector('a[href^="/admin/categories/"][href$="/edit"]');
      return a ? a.getAttribute("href") : null;
    `);
    results.record(
      "admin-list",
      "admin categories list renders with edit links",
      !!rowHref,
      { note: rowHref || "no /admin/categories/:id/edit link found" },
    );

    if (rowHref) {
      await page.goto(`${BASE}${rowHref}`, { waitMs: 900 });
      const form = await page.eval(`
        const fieldNames = ["imageUrl", "mobileImageUrl"];
        const inputs = {};
        for (const n of fieldNames) {
          inputs[n] = [...document.querySelectorAll('input[type="hidden"][name="' + n + '"]')].map((i) => i.value);
        }
        // Each ImagePicker renders its label as the first <span> in its <label>.
        const pickerLabels = [...document.querySelectorAll("label > span:first-child")]
          .map((el) => (el.textContent || "").trim())
          .filter(Boolean);
        return {
          inputs,
          pickerLabels,
          selects: [...document.querySelectorAll("label button")].length,
        };
      `);

      const one = (n) => form.inputs[n].length === 1;
      const labelFor = (needle) =>
        form.pickerLabels.find((l) => l.toLowerCase().startsWith(needle.toLowerCase())) || null;

      results.record(
        "admin-desktop-picker",
        'edit form exposes exactly one "Desktop Image" picker bound to imageUrl',
        one("imageUrl") &&
          form.inputs.imageUrl[0].length > 0 &&
          !!labelFor("Desktop Image"),
        {
          note: `imageUrl=${short(form.inputs.imageUrl[0] || "")} | labels=${form.pickerLabels.join(" / ")}`,
          mismatch: !one("imageUrl")
            ? `expected 1 input[name=imageUrl], found ${form.inputs.imageUrl.length}`
            : !labelFor("Desktop Image")
              ? `no picker labelled "Desktop Image" (saw: ${form.pickerLabels.join(" / ")})`
              : undefined,
        },
      );

      results.record(
        "admin-mobile-picker",
        'edit form exposes exactly one "Mobile Image" picker bound to mobileImageUrl',
        one("mobileImageUrl") && !!labelFor("Mobile Image"),
        {
          note: `mobileImageUrl=${short(form.inputs.mobileImageUrl[0] || "")} | labels=${form.pickerLabels.join(" / ")}`,
          mismatch: !one("mobileImageUrl")
            ? `expected 1 input[name=mobileImageUrl], found ${form.inputs.mobileImageUrl.length}`
            : !labelFor("Mobile Image")
              ? `no picker labelled "Mobile Image" (saw: ${form.pickerLabels.join(" / ")})`
              : undefined,
        },
      );

      results.record(
        "admin-two-pickers",
        "the form offers two independent image pickers side by side",
        form.selects >= 2,
        { note: `${form.selects} picker trigger(s)` },
      );

      // The new field must reuse the EXISTING uploader, not a new one: opening
      // the Mobile picker must show the same "Choose Image" modal with the same
      // Library / Upload tabs the Desktop picker uses.
      const modal = await page.eval(`
        const label = [...document.querySelectorAll("label")].find(
          (l) => /^\\s*Mobile Image/i.test((l.textContent || "")),
        );
        const btn = label?.querySelector("button");
        if (!btn) return { noTrigger: true };
        btn.scrollIntoView({ block: "center", behavior: "instant" });
        const r = btn.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      `);
      if (modal.noTrigger) {
        results.record(
          "admin-mobile-reuses-uploader",
          "Mobile picker opens the existing Choose Image uploader modal",
          false,
          { note: "no trigger button inside the Mobile Image label" },
        );
        failed = true;
      } else {
        await page.clickAt(modal.x, modal.y);
        await sleep(500);
        const opened = await page.eval(`
          return {
            heading: [...document.querySelectorAll("h3")].some((h) => /choose image/i.test(h.textContent || "")),
            tabs: [...document.querySelectorAll("button")].map((b) => (b.textContent || "").trim())
              .filter((t) => /^(media library|upload new)$/i.test(t)),
          };
        `);
        results.record(
          "admin-mobile-reuses-uploader",
          "Mobile picker opens the existing Choose Image uploader modal (Media Library + Upload)",
          opened.heading && opened.tabs.length === 2,
          {
            note: `heading=${opened.heading} tabs=${opened.tabs.join(",")}`,
            mismatch: !opened.heading
              ? 'no "Choose Image" modal appeared'
              : opened.tabs.length !== 2
                ? `expected Media Library + Upload New tabs, saw [${opened.tabs.join(",")}]`
                : undefined,
          },
        );
        if (!opened.heading) failed = true;
        // Close the modal so the new-form probe starts clean.
        await page.eval(`
          const btns = [...document.querySelectorAll("button")];
          const x = btns.find((b) => b.querySelector("svg.lucide-x"));
          if (x) x.click();
          return true;
        `);
        await sleep(300);
      }
    }

    // The new-category form must offer the same two pickers, both empty.
    await page.goto(`${BASE}/admin/categories/new`, { waitMs: 900 });
    const fresh = await page.eval(`
      return {
        desktopInput: document.querySelectorAll('input[type="hidden"][name="imageUrl"]').length,
        mobileInput: document.querySelectorAll('input[type="hidden"][name="mobileImageUrl"]').length,
        desktopEmpty: document.querySelector('input[type="hidden"][name="imageUrl"]')?.value === "",
        mobileEmpty: document.querySelector('input[type="hidden"][name="mobileImageUrl"]')?.value === "",
        selects: [...document.querySelectorAll("label button")].length,
      };
    `);
    results.record(
      "admin-new-form",
      "new-category form offers both pickers, both empty",
      fresh.desktopInput === 1 &&
        fresh.mobileInput === 1 &&
        fresh.desktopEmpty &&
        fresh.mobileEmpty &&
        fresh.selects >= 2,
      {
        note: `imageUrl=${fresh.desktopInput} mobileImageUrl=${fresh.mobileInput} selects=${fresh.selects} bothEmpty=${fresh.desktopEmpty && fresh.mobileEmpty}`,
      },
    );

    results.record(
      "admin-clean",
      "no page errors in the admin category form",
      page.pageErrors.length === 0,
      { note: page.pageErrors.slice(0, 3).join(" | ") || "none" },
    );
    if (page.pageErrors.length) failed = true;

    await page.close();
  }
} finally {
  await chrome.close();
}

const summary = results.summary("Category mobile image — homepage slides");
process.exit(failed || summary.fail > 0 ? 1 : 0);

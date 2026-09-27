/**
 * Real-browser mobile interaction QA: the overlays that static layout audits
 * cannot judge - hamburger menu, search panel, bag panel, AI chat widget and
 * the admin navigation drawer - opened with real taps at 390x844, checked for
 * viewport fit, horizontal overflow, closability and working navigation.
 *
 * Usage: node tests/qa/mobile-overlays-qa.mjs [baseUrl]
 */
import { launchChrome, openPage, sleep } from "./lib/cdp.mjs";
import "./load-env.mjs";

const BASE = (
  process.argv[2] ||
  process.env.QA_BASE_URL ||
  "http://127.0.0.1:3210"
).replace(/\/$/, "");
const PORT = 9362;

let failures = 0;
function check(name, ok, detail) {
  if (!ok) failures++;
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}: ${detail}`);
}

const OVERFLOW = `
  const vw = document.documentElement.clientWidth;
  const scrollW = Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0);
  const fixed = [...document.querySelectorAll("*")].filter(el => getComputedStyle(el).position === "fixed" && el.getBoundingClientRect().width > 0);
  const tooWide = fixed.filter(el => { const r = el.getBoundingClientRect(); return r.width > vw + 1 || r.left < -1 || r.right > vw + 1; })
    .map(el => el.tagName + "." + (el.className || "").toString().slice(0, 60) + " w=" + Math.round(el.getBoundingClientRect().width));
  return { vw, overflow: scrollW - vw, tooWide };
`;

const chrome = await launchChrome({ port: PORT });
const page = await openPage(PORT, { width: 390, height: 844, });

async function tapLabel(label, index = 0) {
  const box = await page.eval(`
    const els = [...document.querySelectorAll('button, a[href], [role="button"]')]
      .filter(el => (el.getAttribute("aria-label") || "") === ${JSON.stringify(label)});
    const el = els[${index}];
    if (!el) return null;
    el.scrollIntoView({ block: "center", behavior: "instant" });
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
  `);
  if (!box) return null;
  if (box.w === 0 || box.h === 0) return null;
  await page.clickAt(box.x, box.y);
  return box;
}

try {
  await page.send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  });

  console.log("\nstorefront home @390x844");
  await page.goto(`${BASE}/`, { waitMs: 800 });

  // Hamburger menu
  let tapped = await tapLabel("Open menu");
  check("hamburger present and tappable", !!tapped, tapped ? `${Math.round(tapped.w)}x${Math.round(tapped.h)}` : "not found");
  await sleep(600);
  let state = await page.eval(`
    const panel = document.querySelector('[data-mobile-menu], [role="dialog"]') ||
      [...document.querySelectorAll("nav, div")].find(el => /Jamawar/.test(el.textContent || "") && el.getBoundingClientRect().width > 200);
    const links = [...document.querySelectorAll('a[href*="category="]')].map(a => a.textContent.trim()).slice(0, 4);
    return { hasPanel: !!panel, links, bodyOverflow: getComputedStyle(document.body).overflow };
  `);
  check("menu opens with category links", state.hasPanel && state.links.length > 0, `links: ${state.links.join(", ")}`);
  let m = await page.eval(OVERFLOW);
  check("menu causes no horizontal overflow", m.overflow <= 1 && m.tooWide.length === 0, `overflow ${m.overflow}px, oversized fixed: ${m.tooWide.join("; ") || "none"}`);

  // Navigate from the menu
  const catHref = await page.eval(`
    const a = [...document.querySelectorAll('a[href*="category="]')][0];
    return a ? a.getAttribute("href") : null;
  `);
  if (catHref) {
    const box = await page.eval(`
      const a = [...document.querySelectorAll('a[href*="category="]')][0];
      a.scrollIntoView({ block: "center", behavior: "instant" });
      const r = a.getBoundingClientRect();
      return { x: r.left + r.width/2, y: r.top + r.height/2 };
    `);
    await page.clickAt(box.x, box.y);
    const ok = await page.waitFor(`location.pathname === "/shop"`, { timeout: 10000, poll: 25 });
    check("menu link navigates", ok, (await page.url()).replace(BASE, ""));
  } else {
    check("menu link navigates", false, "no category link found");
  }

  // Search panel
  console.log("\nsearch panel");
  await page.goto(`${BASE}/`, { waitMs: 700 });
  tapped = await tapLabel("Search");
  check("search button tappable", !!tapped, tapped ? "yes" : "not found");
  await sleep(500);
  const searchOpen = await page.eval(`
    const input = document.querySelector('input[type="search"], input[placeholder*="Search" i]');
    return { hasInput: !!input, focused: document.activeElement === input };
  `);
  check("search panel opens with input", searchOpen.hasInput, `input found: ${searchOpen.hasInput}`);
  if (searchOpen.hasInput) {
    await page.type('input[type="search"], input[placeholder*="Search" i]', "jamawar");
    await sleep(1500);
    const results = await page.eval(`
      const links = [...document.querySelectorAll('a[href^="/product/"]')].map(a => a.textContent.trim()).filter(Boolean);
      return { count: links.length, first: links.slice(0, 3) };
    `);
    check("search returns products", results.count > 0, `${results.count} results: ${results.first.join(", ")}`);
  }
  m = await page.eval(OVERFLOW);
  check("search panel no horizontal overflow", m.overflow <= 1 && m.tooWide.length === 0, `overflow ${m.overflow}px, oversized fixed: ${m.tooWide.join("; ") || "none"}`);
  await tapLabel("Close Search");
  const searchClosed = await page.waitFor(`!document.querySelector('[role="dialog"]')`, {
    timeout: 6000,
    poll: 100,
  });
  check("search panel closes", searchClosed, searchClosed ? "dialog removed" : "dialog still present");

  // Bag panel
  console.log("\nbag panel");
  tapped =
    (await tapLabel("Cart")) ||
    (await tapLabel("Bag")) ||
    (await tapLabel("My Bag")) ||
    (await tapLabel("Open bag"));
  check("bag button tappable", !!tapped, tapped ? "yes" : "not found");
  const bagDialog = await page.waitFor(
    `(() => { const d = document.querySelector('[role="dialog"]'); return !!d && /bag/i.test(d.getAttribute("aria-label") || ""); })()`,
    { timeout: 8000, poll: 100 },
  );
  await sleep(900);
  m = await page.eval(OVERFLOW);
  const bagState = await page.eval(`
    const dlg = document.querySelector('[role="dialog"]');
    const r = dlg ? dlg.getBoundingClientRect() : null;
    return {
      hasPanel: !!dlg,
      label: dlg ? dlg.getAttribute("aria-label") : "",
      text: dlg ? (dlg.innerText || "").trim().slice(0, 60) : "",
      w: r ? Math.round(r.width) : 0,
      left: r ? Math.round(r.left) : 0,
    };
  `);
  check(
    "bag panel opens within viewport",
    bagDialog && bagState.hasPanel && m.overflow <= 1 && m.tooWide.length === 0,
    `panel "${bagState.label}" "${bagState.text.replace(/\n/g, " ")}" ${bagState.w}px @left ${bagState.left}, overflow ${m.overflow}px, oversized fixed: ${m.tooWide.join("; ") || "none"}`,
  );
  await tapLabel("Close Your Bag") || await tapLabel("Close Bag");
  const bagClosed = await page.waitFor(`!document.querySelector('[role="dialog"]')`, {
    timeout: 6000,
    poll: 100,
  });
  check("bag panel closes", bagClosed, bagClosed ? "dialog removed" : "dialog still present");

  // AI chat widget
  console.log("\nAI chat widget");
  await page.goto(`${BASE}/`, { waitMs: 700 });
  tapped = await tapLabel("Open AI Salesman");
  check("AI chat trigger tappable", !!tapped, tapped ? `${Math.round(tapped.w)}x${Math.round(tapped.h)}` : "not found");
  await sleep(800);
  const chat = await page.eval(`
    const input = [...document.querySelectorAll("textarea, input")].find(el => /message|ask/i.test(el.getAttribute("placeholder") || ""));
    const panels = [...document.querySelectorAll("div")].filter(el => getComputedStyle(el).position === "fixed" && el.getBoundingClientRect().height > 200);
    return { hasInput: !!input, panels: panels.length };
  `);
  m = await page.eval(OVERFLOW);
  check("AI chat opens inside the viewport", chat.panels > 0 && m.overflow <= 1 && m.tooWide.length === 0, `panels ${chat.panels}, input ${chat.hasInput}, overflow ${m.overflow}px, oversized fixed: ${m.tooWide.join("; ") || "none"}`);
  tapped = await tapLabel("Close chat");
  check("AI chat closable", !!tapped, tapped ? "close button found" : "no close button");
  await sleep(500);

  // Admin drawer
  console.log("\nadmin navigation");
  await page.goto(`${BASE}/login`, { waitMs: 400 });
  await page.type("#email", process.env.ADMIN_EMAIL);
  await page.type("#password", process.env.ADMIN_PASSWORD);
  await page.clickSelector('button[type="submit"]');
  const inAdmin = await page.waitFor(`location.pathname !== "/login"`, { timeout: 25000, poll: 100 });
  check("admin login", inAdmin, (await page.url()).replace(BASE, ""));
  await page.goto(`${BASE}/admin`, { waitMs: 900 });
  tapped = await tapLabel("Open menu");
  check("admin menu trigger tappable", !!tapped, tapped ? "yes" : "not found");
  await sleep(600);
  m = await page.eval(OVERFLOW);
  const navLinks = await page.eval(`
    const nav = document.querySelector('nav[aria-label="Admin navigation"]');
    return { visible: !!nav && nav.getBoundingClientRect().width > 100, links: nav ? nav.querySelectorAll("a").length : 0 };
  `);
  check("admin drawer opens with links", navLinks.visible && navLinks.links > 3, `${navLinks.links} links, overflow ${m.overflow}px, oversized fixed: ${m.tooWide.join("; ") || "none"}`);
  const productsHref = await page.eval(`
    const nav = document.querySelector('nav[aria-label="Admin navigation"]');
    if (!nav) return null;
    const a = [...nav.querySelectorAll("a")].find(x => /products/i.test(x.textContent));
    return a ? a.getAttribute("href") : null;
  `);
  if (productsHref) {
    const box = await page.eval(`
      const nav = document.querySelector('nav[aria-label="Admin navigation"]');
      const a = [...nav.querySelectorAll("a")].find(x => /products/i.test(x.textContent));
      const r = a.getBoundingClientRect();
      return { x: r.left + r.width/2, y: r.top + r.height/2 };
    `);
    await page.clickAt(box.x, box.y);
    const ok = await page.waitFor(`location.pathname === ${JSON.stringify(productsHref)}`, { timeout: 10000, poll: 25 });
    check("admin drawer link navigates", ok, (await page.url()).replace(BASE, ""));
  }

  console.log(
    `\nconsole errors: ${page.consoleErrors.length}, page errors: ${page.pageErrors.length}`,
  );
  for (const e of [...page.pageErrors, ...page.consoleErrors].slice(0, 6)) {
    console.log(`  ! ${e.slice(0, 200)}`);
  }
} finally {
  await page.close();
  await chrome.close();
}

console.log(failures === 0 ? "\nALL mobile overlay checks passed" : `\n${failures} mobile overlay check(s) failed`);
process.exit(failures === 0 ? 0 : 1);

import { launchChrome, openPage, sleep } from "./lib/cdp.mjs";
import "./load-env.mjs";

const BASE = "http://127.0.0.1:3210";
const PORT = 9348;
const chrome = await launchChrome({ port: PORT });
const page = await openPage(PORT, { width: 1440, height: 900 });
try {
  await page.goto(`${BASE}/login`, { waitMs: 300 });
  await page.type("#email", process.env.ADMIN_EMAIL);
  await page.type("#password", process.env.ADMIN_PASSWORD);
  await page.clickSelector('button[type="submit"]');
  await page.waitFor(`location.pathname !== "/login"`, { timeout: 25000, poll: 100 });
  await sleep(1500);

  const before = await page.eval(`
    const wrap = document.querySelector('[data-account-button]');
    return {
      html: wrap ? wrap.outerHTML.slice(0, 600) : null,
      label: wrap ? wrap.innerText.trim().slice(0, 60) : null,
    };
  `);
  console.log("BEFORE:", JSON.stringify(before, null, 1));

  const t = await page.box("[data-account-button] button");
  console.log("trigger box:", JSON.stringify(t));
  await page.clickAt(t.x, t.y);
  await sleep(700);

  const after = await page.eval(`
    const wrap = document.querySelector('[data-account-button]');
    const all = [...document.querySelectorAll("button,a")].map(el => (el.textContent||"").trim().slice(0,30)).filter(Boolean);
    return {
      expanded: wrap ? wrap.querySelector('[aria-expanded]')?.getAttribute('aria-expanded') : null,
      dropdown: !!document.querySelector('[data-account-dropdown]'),
      signOutCount: all.filter(t => /sign out/i.test(t)).length,
      menuItems: all.slice(0, 25),
    };
  `);
  console.log("AFTER:", JSON.stringify(after, null, 1));
} finally {
  await page.close();
  await chrome.close();
}

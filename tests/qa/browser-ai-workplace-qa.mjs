/**
 * BROWSER QA — AI Workplace chat-history load (real browser, real running app).
 *
 * Requirement (docs/fix.txt item 2 + item 4): the chat-history load fix must be
 * tested against the REAL running app in a REAL browser — not inferred by code
 * reading. This script:
 *
 *   1. opens /admin/ai in a headless Edge/Chromium browser (desktop width),
 *   2. signs in as admin,
 *   3. sends several messages in a NEW conversation (conversation A),
 *   4. starts ANOTHER new conversation (conversation B) and sends a message,
 *   5. opens the History drawer, clicks the older conversation A,
 *   6. verifies conversation A's real prior messages render in the chat view
 *      (and that the drawer closes over the chat, not beside it),
 *   7. writes a desktop screenshot to docs/evidence/admin-ai-desktop.png,
 *   8. reports how the history panel is laid out on desktop (overlay vs column).
 *
 * Usage: node tests/qa/browser-ai-workplace-qa.mjs
 * Requires: a running dev server on APP_URL (from .env.test), admin creds in
 * .env.test, and a local Edge or Chrome install (playwright-core channels).
 */
import "./load-env.mjs";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const EMAIL = process.env.ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_PASSWORD;

const here = path.dirname(fileURLToPath(import.meta.url));
const evidenceDir = path.resolve(here, "..", "..", "docs", "evidence");
const screenshotPath = path.join(evidenceDir, "admin-ai-desktop.png");

if (!EMAIL || !PASSWORD) {
  throw new Error("ADMIN_EMAIL / ADMIN_PASSWORD missing from .env.test");
}

let passCount = 0;
let failCount = 0;
const failures = [];

function check(id, scenario, pass, details = {}) {
  if (pass) {
    passCount++;
    console.log(`[✓] ${id}: ${scenario} — PASS`);
  } else {
    failCount++;
    failures.push({ id, scenario, ...details });
    console.log(`[✗] ${id}: ${scenario} — FAIL`);
  }
  if (details.note) console.log(`    Note: ${details.note}`);
  if (details.evidence) console.log(`    Evidence: ${details.evidence}`);
}

// Deterministic per-run text so we can prove the OLD conversation rendered.
const CONV_A_Q1 = `QA browser check A question one ${Date.now()}`;
const CONV_A_Q2 = "QA browser check A second question";
const CONV_B_Q1 = `QA browser check B question ${Date.now()}`;

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  BROWSER QA — AI Workplace chat history load (real browser)");
  console.log("═══════════════════════════════════════════════════════════\n");
  console.log(`  target: ${APP_URL}`);

  const browser = await chromium.launch({
    headless: true,
    channel: process.env.BROWSER_CHANNEL ?? "msedge",
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);

    // ── 1. Sign in ──────────────────────────────────────────────────────
    console.log("\n[1] sign-in…");
    await page.goto(`${APP_URL}/login`, { waitUntil: "networkidle" });
    await page.fill("#email", EMAIL);
    await page.fill("#password", PASSWORD);
    await Promise.all([
      page.waitForURL((url) => !url.pathname.startsWith("/login"), {
        timeout: 20000,
      }),
      page.click('button[type="submit"]:has-text("Sign in")'),
    ]);
    check("login", "admin signed in", true, { evidence: page.url() });

    // ── 2. Open AI Workplace ───────────────────────────────────────────
    console.log("\n[2] opening /admin/ai…");
    await page.goto(`${APP_URL}/admin/ai`, { waitUntil: "networkidle" });
    await page.waitForSelector('h1:has-text("AI Workplace")');
    await page.waitForSelector('h2:has-text("AI Manager")');

    const chatHeaderBox = await page
      .locator('header:has(h2:has-text("AI Manager"))')
      .boundingBox();
    console.log(`    chat header box: ${JSON.stringify(chatHeaderBox)}`);

    // ── 3. Conversation A: several messages in a NEW conversation ──────
    console.log("\n[3] sending conversation A messages…");
    const input = page.locator("#admin-chat-input");

    async function sendMessage(text) {
      await input.fill(text);
      await page.click('button[aria-label="Send message"]');
      // The button is disabled for the whole streaming duration. Wait for the
      // busy indicator to appear (so we know the stream started), then for it
      // to disappear (stream finished) — plus the send button being enabled.
      await page
        .waitForSelector("span:has-text('is working')", { timeout: 20000 })
        .catch(() => {});
      await page.waitForSelector("span:has-text('is working')", {
        state: "detached",
        timeout: 120000,
      });
      // Note: the send button re-enables only after new input exists (it is
      // disabled while the input is empty), so the busy pill disappearing is
      // the reliable "response finished" signal.
      const err = await page
        .locator("div.rounded-2xl.bg-red-50")
        .count()
        .catch(() => 0);
      if (err > 0) throw new Error("chat error bubble appeared");
    }

    await sendMessage(CONV_A_Q1);
    await page.waitForFunction(
      (q) => document.body.innerText.includes(q),
      CONV_A_Q1,
      { timeout: 60000 },
    ).catch(() => {});

    // New conversation A continuity: second message in same thread.
    await sendMessage(CONV_A_Q2);
    await page.waitForFunction(
      (q) => document.body.innerText.includes(q),
      CONV_A_Q2,
      { timeout: 60000 },
    ).catch(() => {});

    const messagesAfterA = await page
      .locator(".whitespace-pre-wrap")
      .count();
    console.log(`    bubbles after conv A: ${messagesAfterA}`);

    // ── 4. New conversation B ──────────────────────────────────────────
    console.log("\n[4] starting new conversation B…");
    await page.click('button[title="Start a new conversation"]');
    await page.waitForFunction(
      () => document.querySelectorAll(".whitespace-pre-wrap").length < 4,
      { timeout: 10000 },
    ).catch(() => {});
    await sendMessage(CONV_B_Q1);
    await page.waitForFunction(
      (q) => document.body.innerText.includes(q),
      CONV_B_Q1,
      { timeout: 60000 },
    ).catch(() => {});

    const messagesAfterB = await page.locator(".whitespace-pre-wrap").count();
    console.log(`    bubbles after conv B: ${messagesAfterB}`);

    // ── 5. Open History drawer, click older conversation A ─────────────
    console.log("\n[5] opening History drawer…");
    await page.click('button[aria-label="Open conversations and audit trail"]');
    await page.waitForSelector('aside[role="dialog"]');

    // Layout check (item 4): drawer must OVERLAY the chat — so while it is
    // open the chat header box must be unchanged (a persistent side column
    // would displace/shrink the chat) and the drawer must be a narrow fixed
    // right-hand overlay, not full-width.
    const drawerBox = await page.locator('aside[role="dialog"]').boundingBox();
    const chatHeaderOpen = await page
      .locator('header:has(h2:has-text("AI Manager"))')
      .boundingBox();
    console.log(`    drawer box: ${JSON.stringify(drawerBox)}`);
    const sameWidth =
      chatHeaderOpen && chatHeaderBox
        ? Math.abs(chatHeaderOpen.width - chatHeaderBox.width) < 6 &&
          Math.abs(chatHeaderOpen.x - chatHeaderBox.x) < 6
        : false;
    const narrowOverlay = drawerBox && drawerBox.width < 700;
    const rightAnchored = drawerBox && drawerBox.x + drawerBox.width >= 1435;
    check(
      "h-layout-drawer-overlay",
      "history opens as overlay drawer on top of full-width chat (chat not displaced)",
      Boolean(sameWidth && narrowOverlay && rightAnchored),
      {
        evidence: `chatBefore=${JSON.stringify(chatHeaderBox)} chatWhileDrawerOpen=${JSON.stringify(chatHeaderOpen)} drawer=${JSON.stringify(drawerBox)}`,
        note: sameWidth
          ? "chat container keeps its full width while drawer is open (overlay, not column)"
          : "chat box changed when drawer opened — chat may be displaced by a side element",
      },
    );

    // The history drawer must show older conversations (including A). Wait for
    // the list to finish loading, then read it.
    await page.waitForFunction(
      () =>
        !document
          .querySelector('aside[role="dialog"]')
          ?.innerText.includes("Loading conversations…"),
      { timeout: 15000 },
    );
    const drawerText = await page.locator('aside[role="dialog"]').innerText();
    check(
      "h-history-shows-conv-a",
      "history drawer lists older conversation A",
      drawerText.includes("QA browser check A"),
      { note: `drawer text: ${drawerText.slice(0, 220).replace(/\n/g, " | ")}` },
    );

    console.log("    clicking older conversation A…");
    // Select the conversation from THIS run (unique timestamp marker), not a
    // stale conversation left by an earlier crashed run.
    const oldConvButton = page
      .locator('aside[role="dialog"] button[type="button"]')
      .filter({ hasText: CONV_A_Q1 })
      .first();
    await oldConvButton.click();
    await page.waitForSelector('aside[role="dialog"]', { state: "detached" }).catch(() => {});

    // ── 6. Verify A's real messages render in the chat view ────────────
    console.log("\n[6] verifying conversation A renders…");
    await page.waitForFunction(
      (q) => document.body.innerText.includes(q),
      CONV_A_Q1,
      { timeout: 15000 },
    ).catch(() => {});
    const chatTextAfterLoad = await page.locator(".whitespace-pre-wrap").allInnerTexts();

    const seesAq1 = chatTextAfterLoad.some((t) => t.includes(CONV_A_Q1));
    const seesAq2 = chatTextAfterLoad.some((t) => t.includes(CONV_A_Q2));
    const seesBq1 = chatTextAfterLoad.some((t) => t.includes(CONV_B_Q1));
    check(
      "h-conv-a-q1-renders",
      "older conversation A question 1 renders in chat after history click",
      seesAq1,
      { evidence: `rendered=${JSON.stringify(chatTextAfterLoad)}` },
    );
    check(
      "h-conv-a-q2-renders",
      "older conversation A question 2 renders in chat after history click",
      seesAq2,
      { evidence: `rendered=${JSON.stringify(chatTextAfterLoad)}` },
    );
    check(
      "h-conv-b-not-bleeded",
      "conversation B messages are NOT shown in conversation A view",
      !seesBq1,
      {
        note: seesBq1
          ? "conversation B text leaked into conversation A view"
          : "no bleed",
      },
    );

    // ── 7. Screenshot (desktop) ────────────────────────────────────────
    console.log("\n[7] screenshot…");
    if (!existsSync(evidenceDir)) mkdirSync(evidenceDir, { recursive: true });
    await page.screenshot({ path: screenshotPath, fullPage: false });
    check("h-screenshot", "desktop screenshot written", existsSync(screenshotPath), {
      evidence: screenshotPath,
    });

    // ── 8. Extra open-drawer screenshot proof of overlay ───────────────
    console.log("\n[8] re-open drawer for overlay-proof screenshot…");
    await page.click('button[aria-label="Open conversations and audit trail"]');
    await page.waitForSelector('aside[role="dialog"]');
    const drawer2Box = await page.locator('aside[role="dialog"]').boundingBox();
    const chatHeaderBox2 = await page
      .locator('header:has(h2:has-text("AI Manager"))')
      .boundingBox();
    const chatUnchanged2 =
      chatHeaderBox2 && chatHeaderBox
        ? Math.abs(chatHeaderBox2.width - chatHeaderBox.width) < 6 &&
          Math.abs(chatHeaderBox2.x - chatHeaderBox.x) < 6
        : false;
    check(
      "h-overlay-proof",
      "with drawer open the chat is still visible beneath (overlay, not column)",
      Boolean(drawer2Box && chatHeaderBox2 && drawer2Box.width < 700 && chatUnchanged2),
      {
        evidence: `drawer=${JSON.stringify(drawer2Box)} chat=${JSON.stringify(chatHeaderBox2)}`,
        note: "drawer is a fixed overlay; chat container retains its full width",
      },
    );
    const overlayScreenshotPath = path.join(evidenceDir, "admin-ai-drawer-open.png");
    await page.screenshot({ path: overlayScreenshotPath, fullPage: false });
    check("h-drawer-screenshot", "drawer-open screenshot written", existsSync(overlayScreenshotPath), {
      evidence: overlayScreenshotPath,
    });
  } finally {
    await browser.close();
  }

  console.log(`\n===== BROWSER AI WORKPLACE QA RESULTS =====`);
  console.log(`  Total: ${passCount + failCount} | PASS: ${passCount} | FAIL: ${failCount}\n`);
  if (failures.length) {
    console.log("═══ FAILED checks ═══");
    for (const f of failures) console.log(`  ✗ ${f.id}: ${f.scenario} — ${f.note ?? ""}`);
  }
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("crash:", e);
  process.exit(1);
});
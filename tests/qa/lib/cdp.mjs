/**
 * Minimal Chrome DevTools Protocol client (no dependencies).
 *
 * Node 22+ ships a global WebSocket, so driving a real Chrome needs nothing
 * beyond `node`. Used by the QA scripts to click real pixels, read real
 * cookies and measure real navigation instead of asserting on source code.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME_PATHS = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Launch a headless Chrome with a throwaway profile and a debug port. */
export async function launchChrome({ port = 9333, headless = true } = {}) {
  const bin = CHROME_PATHS.find((p) => existsSync(p));
  if (!bin) throw new Error("No Chrome/Chromium binary found");

  const profile = mkdtempSync(join(tmpdir(), "qa-chrome-"));
  const args = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--disable-background-networking",
    "--disable-sync",
    "--disable-gpu",
    "--window-size=1440,900",
    "about:blank",
  ];
  if (headless) args.unshift("--headless=new");

  const proc = spawn(bin, args, { stdio: "ignore", detached: false });

  let version = null;
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) {
        version = await res.json();
        break;
      }
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  if (!version) {
    proc.kill();
    throw new Error("Chrome did not expose a debugging port");
  }

  return {
    port,
    proc,
    async close() {
      try {
        proc.kill();
      } catch {
        /* already gone */
      }
      await sleep(300);
      try {
        rmSync(profile, { recursive: true, force: true });
      } catch {
        /* best effort */
      }
    },
  };
}

/** Open a tab and return a small typed wrapper around its CDP session. */
export async function openPage(port, { width = 1440, height = 900 } = {}) {
  const res = await fetch(
    `http://127.0.0.1:${port}/json/new?about:blank`,
    { method: "PUT" },
  );
  const target = await res.json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });

  let nextId = 1;
  const pending = new Map();
  const listeners = new Map();

  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(`${msg.error.message} (${msg.error.code})`));
      else resolve(msg.result);
      return;
    }
    const handlers = listeners.get(msg.method);
    if (handlers) for (const h of handlers) h(msg.params);
  });

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });

  const on = (method, handler) => {
    if (!listeners.has(method)) listeners.set(method, new Set());
    listeners.get(method).add(handler);
    return () => listeners.get(method).delete(handler);
  };

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Log.enable");
  await send(
    "Emulation.setDeviceMetricsOverride",
    {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 700,
    },
  );

  const page = {
    send,
    on,
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],

    /** Navigate and wait for the load event (plus optional settle time). */
    async goto(url, { waitMs = 250, timeout = 45000 } = {}) {
      const loaded = new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error(`load timeout for ${url}`)),
          timeout,
        );
        const off = on("Page.loadEventFired", () => {
          clearTimeout(timer);
          off();
          resolve();
        });
      });
      await send("Page.navigate", { url });
      await loaded;
      if (waitMs) await sleep(waitMs);
    },

    /**
     * Go back in session history and wait for the load event. When the page is
     * restored from the back/forward cache no load event fires, so this also
     * resolves after a short settle in that case.
     */
    async goBack({ waitMs = 250, timeout = 45000 } = {}) {
      let loaded = false;
      const off = on("Page.loadEventFired", () => {
        loaded = true;
      });
      const hist = await send("Page.getNavigationHistory");
      const current = hist.entries[hist.currentIndex];
      if (!current || current.id === 0) {
        off();
        throw new Error("no history entry to go back to");
      }
      await send("Page.navigateToHistoryEntry", {
        entryId: hist.entries[hist.currentIndex - 1].id,
      });
      const deadline = Date.now() + timeout;
      while (!loaded && Date.now() < deadline) await sleep(50);
      off();
      if (waitMs) await sleep(waitMs);
      return { loadEventFired: loaded };
    },

    /** Evaluate an expression in the page and return its JSON value. */
    async eval(expression) {      const r = await send("Runtime.evaluate", {
        expression: `(async () => { ${expression} })()`,
        awaitPromise: true,
        returnByValue: true,
      });
      if (r.exceptionDetails) {
        throw new Error(
          r.exceptionDetails.exception?.description ||
            r.exceptionDetails.text,
        );
      }
      return r.result.value;
    },

    /** Viewport coordinates of the first element matching `selector`. */
    async box(selector, index = 0) {
      return page.eval(`
        const els = document.querySelectorAll(${JSON.stringify(selector)});
        const el = els[${index}];
        if (!el) return null;
        el.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const hit = document.elementFromPoint(cx, cy);
        return {
          x: cx, y: cy, w: r.width, h: r.height,
          visible: r.width > 0 && r.height > 0,
          text: (el.textContent || "").trim().slice(0, 60),
          href: el.getAttribute("href"),
          covered: !(hit && (hit === el || el.contains(hit))),
          hitTag: hit ? hit.tagName + "." + (hit.className || "").toString().slice(0, 40) : null,
        };
      `);
    },

    /** A real input-level click at viewport coordinates. */
    async clickAt(x, y) {
      const base = { x, y, button: "left", clickCount: 1, buttons: 1 };
      await send("Input.dispatchMouseEvent", { type: "mouseMoved", ...base, buttons: 0 });
      await send("Input.dispatchMouseEvent", { type: "mousePressed", ...base });
      await send("Input.dispatchMouseEvent", { type: "mouseReleased", ...base });
    },

    /** Click an element for real: scroll it into view, then click its pixels. */
    async clickSelector(selector, index = 0) {
      const b = await page.box(selector, index);
      if (!b) throw new Error(`no element for ${selector}[${index}]`);
      await page.clickAt(b.x, b.y);
      return b;
    },

    /**
     * Box of the nth element whose trimmed text starts with `text`, after
     * scrolling it into view. Returns null until it has a real layout box, so
     * callers can poll for "actually clickable" instead of "present in DOM".
     */
    async boxByText(text, index = 0) {
      return page.eval(`
        const matches = [...document.querySelectorAll("a, button")].filter(
          (el) => (el.textContent || "").trim().startsWith(${JSON.stringify(text)}),
        );
        const el = matches[${index}];
        if (!el) return { missing: true };
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return { unlaid: true };
        el.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
        const r2 = el.getBoundingClientRect();
        const cx = r2.left + r2.width / 2;
        const cy = r2.top + r2.height / 2;
        const hit = document.elementFromPoint(cx, cy);
        return {
          x: cx, y: cy, w: r2.width, h: r2.height,
          text: (el.textContent || "").trim().slice(0, 60),
          href: el.getAttribute("href"),
          covered: !(hit && (hit === el || el.contains(hit) || el.querySelector("svg") === hit)),
          hitTag: hit ? hit.tagName + "." + (hit.className || "").toString().slice(0, 50) : null,
        };
      `);
    },

    /** Wait until the nth element matching `text` is laid out and clickable. */
    async waitForText(text, index = 0, { timeout = 15000, poll = 20 } = {}) {
      const deadline = Date.now() + timeout;
      let last = null;
      while (Date.now() < deadline) {
        try {
          last = await page.boxByText(text, index);
          if (last && !last.missing && !last.unlaid) return last;
        } catch {
          /* page may be mid-navigation */
        }
        await sleep(poll);
      }
      return last;
    },

    /** Type text into an input the way a user does (per character). */
    async type(selector, text) {
      await page.eval(`
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) throw new Error("no input " + ${JSON.stringify(selector)});
        el.focus();
        return true;
      `);
      for (const ch of text) {
        await send("Input.dispatchKeyEvent", { type: "keyDown", text: ch });
        await send("Input.dispatchKeyEvent", { type: "keyUp", text: ch });
      }
    },

    async waitFor(expression, { timeout = 20000, poll = 100 } = {}) {
      const deadline = Date.now() + timeout;
      while (Date.now() < deadline) {
        try {
          if (await page.eval(`return !!(${expression});`)) return true;
        } catch {
          /* page may be mid-navigation */
        }
        await sleep(poll);
      }
      return false;
    },

    async url() {
      return page.eval("return location.href;");
    },

    async cookies() {
      const r = await send("Network.getCookies");
      return r.cookies;
    },

    async close() {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      try {
        await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`);
      } catch {
        /* ignore */
      }
    },
  };

  page.on("Runtime.consoleAPICalled", (p) => {
    if (p.type === "error") {
      page.consoleErrors.push(
        (p.args || []).map((a) => a.value ?? a.description ?? "").join(" "),
      );
    }
  });
  page.on("Runtime.exceptionThrown", (p) => {
    page.pageErrors.push(
      p.exceptionDetails?.exception?.description ||
        p.exceptionDetails?.text ||
        "unknown",
    );
  });
  page.on("Network.loadingFailed", (p) => {
    if (p.type !== "Image" || !p.canceled) {
      page.failedRequests.push(`${p.type} ${p.errorText}`);
    }
  });

  return page;
}

export { sleep };

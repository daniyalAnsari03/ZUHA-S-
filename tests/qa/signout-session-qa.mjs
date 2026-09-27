/**
 * Real-browser QA: does sign-out really terminate the server session?
 *
 * Clicks the real "Sign Out" control, then checks two things a UI redirect
 * cannot prove on its own:
 *   1. the Supabase auth cookies are gone from the browser, and
 *   2. a refresh token issued for the same user is rejected by GoTrue, i.e.
 *      the session was actually revoked server-side rather than only hidden
 *      in the client.
 *
 * Usage: node tests/qa/signout-session-qa.mjs [baseUrl]
 */
import { launchChrome, openPage, sleep } from "./lib/cdp.mjs";
import "./load-env.mjs";

const BASE = (
  process.argv[2] ||
  process.env.QA_BASE_URL ||
  "http://127.0.0.1:3210"
).replace(/\/$/, "");
const PORT = 9347;

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const EMAIL = process.env.ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_PASSWORD;

if (!SUPABASE_URL || !ANON_KEY || !EMAIL || !PASSWORD) {
  console.error("Missing Supabase URL/key or ADMIN_EMAIL/ADMIN_PASSWORD in .env.test");
  process.exit(2);
}

/** Independent session for the same user, used to probe revocation later. */
async function issueRefreshToken() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: ANON_KEY,
      "Content-Type": "application/json",
      "User-Agent": "node",
    },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`password grant failed: ${res.status} ${JSON.stringify(body)}`);
  return body.refresh_token;
}

/** Is this refresh token still accepted by the auth server? */
async function refreshWorks(refreshToken) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: {
      apikey: ANON_KEY,
      "Content-Type": "application/json",
      "User-Agent": "node",
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, error: body.error_description || body.msg || body.error || null };
}

const control = await issueRefreshToken();
console.log(`control session issued for ${EMAIL}`);

const chrome = await launchChrome({ port: PORT });
const page = await openPage(PORT, { width: 1440, height: 900 });
let failures = 0;

function check(name, ok, detail) {
  if (!ok) failures++;
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}: ${detail}`);
}

try {
  // 1. Sign in through the real login form.
  await page.goto(`${BASE}/login`, { waitMs: 300 });
  await page.type("#email", EMAIL);
  await page.type("#password", PASSWORD);
  await page.clickSelector('button[type="submit"]');
  const loggedIn = await page.waitFor(`location.pathname !== "/login"`, {
    timeout: 25000,
    poll: 100,
  });
  check("login", loggedIn, `landed on ${(await page.url()).replace(BASE, "")}`);
  if (!loggedIn) throw new Error("could not sign in");

  // Session must be live before we test that sign-out kills it.
  const liveBefore = await refreshWorks(control);
  check("control session valid before sign-out", liveBefore.ok, `status ${liveBefore.status}`);

  const cookiesBefore = (await page.cookies()).filter((c) => c.name.includes("auth-token"));
  check(
    "auth cookies present while signed in",
    cookiesBefore.length > 0,
    cookiesBefore.map((c) => c.name).join(", "),
  );

  // 2. Open the account menu and click the real Sign Out control.
  await page.goto(`${BASE}/`, { waitMs: 0 });
  const menuReady = await page.waitFor(
    `!!document.querySelector('[data-account-button] [aria-label="My Account"]')`,
    { timeout: 25000, poll: 50 },
  );
  check("navbar shows signed-in account menu", menuReady, "My Account trigger present");
  if (!menuReady) throw new Error("signed-in navbar never appeared");

  const trigger = await page.box("[data-account-button] [aria-label='My Account']");
  if (!trigger) throw new Error("account menu trigger not found");
  await page.clickAt(trigger.x, trigger.y);
  const signOutBox = await page.waitForText("Sign Out", 0, { timeout: 10000 });
  if (!signOutBox || signOutBox.missing) throw new Error("Sign Out control not found");
  check("account menu opens", true, `Sign Out at ${Math.round(signOutBox.x)},${Math.round(signOutBox.y)}`);
  await page.clickAt(signOutBox.x, signOutBox.y);

  const redirected = await page.waitFor(`location.pathname === "/"`, {
    timeout: 15000,
    poll: 50,
  });
  check("redirected to storefront", redirected, `at ${(await page.url()).replace(BASE, "")}`);

  // Give any in-flight sign-out request time to land (or be cancelled).
  await sleep(2500);

  // 3. Cookies must be gone.
  const cookiesAfter = (await page.cookies()).filter((c) => c.name.includes("auth-token"));
  check(
    "auth cookies cleared",
    cookiesAfter.length === 0,
    cookiesAfter.length ? cookiesAfter.map((c) => `${c.name}=${c.value.slice(0, 12)}...`).join(", ") : "none left",
  );

  // 4. The server session must be dead: a sibling refresh token is rejected.
  const liveAfter = await refreshWorks(control);
  check(
    "server session revoked (refresh token rejected)",
    !liveAfter.ok,
    `status ${liveAfter.status} ${liveAfter.error || ""}`.trim(),
  );

  // 5. And the storefront must actually treat the browser as signed out.
  await page.goto(`${BASE}/account`, { waitMs: 800 });
  const accountShowsLogin = await page.eval(`
    return {
      url: location.href,
      hasSignIn: !!document.querySelector('a[href="/login"], [data-account-button]'),
      text: document.body.innerText.slice(0, 200),
    };
  `);
  check(
    "protected page no longer authenticated",
    accountShowsLogin.url.includes("/login") || !/sign out/i.test(accountShowsLogin.text),
    `url ${accountShowsLogin.url.replace(BASE, "")}, mentions Sign Out: ${/sign out/i.test(accountShowsLogin.text)}`,
  );

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

console.log(failures === 0 ? "\nALL sign-out checks passed" : `\n${failures} sign-out check(s) failed`);
process.exit(failures === 0 ? 0 : 1);

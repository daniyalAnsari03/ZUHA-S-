"use client";

/**
 * Upper bound on how long sign-out may delay the redirect. The session has to
 * be terminated before the browser leaves the page, but a slow or unreachable
 * server must never trap the user on a signed-in screen.
 */
const SIGN_OUT_TIMEOUT_MS = 2500;

/**
 * Client-side sign out.
 *
 * The redirect still feels immediate, but the session is genuinely terminated
 * first: the server revokes the refresh token and expires the httpOnly auth
 * cookies. That round-trip has to land before navigation, because navigating
 * away cancels an in-flight request and would leave the server session (and its
 * refresh token) alive. The wait is capped, so a slow server degrades to
 * "redirect anyway" instead of hanging.
 *
 * Sign-out runs through the `/api/session` endpoint rather than a browser
 * Supabase client, which is what previously forced the whole client-side auth
 * SDK into the first-load bundle of every storefront page.
 */
export async function signOutClient(): Promise<void> {
  if (typeof window === "undefined") return;

  await Promise.race([
    fetch("/api/session", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: "{}",
    }).catch(() => {}),
    new Promise<void>((resolve) => {
      setTimeout(resolve, SIGN_OUT_TIMEOUT_MS);
    }),
  ]);

  // A hard navigation is required here, and is the one place in the app that
  // uses `window.location` on purpose: `router.push()` would unmount this
  // component and cancel the in-flight sign-out request, leaving the server
  // session and its refresh token alive. `location.assign` also guarantees a
  // fresh document, so no cached storefront HTML is served post-sign-out.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.href = "/";
}

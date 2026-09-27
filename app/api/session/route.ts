import { NextResponse } from "next/server";

import { getAuthUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Session endpoints for the storefront chrome.
 *
 * The navbar needs two things the server already knows: whether a shopper is
 * signed in (and whether they are an admin), and how to terminate the session.
 * Both are served here so the storefront never has to construct a browser
 * Supabase client, which kept a large client-side dependency in the first-load
 * bundle of every page just to read one value.
 *
 * Both handlers are strictly scoped to the caller's own cookie jar — no
 * identity or authorization decision is ever taken from the request body.
 */

/** Report the current account state for the navbar account entry point. */
export async function GET() {
  const user = await getAuthUser();

  const state = !user
    ? "signedOut"
    : user.role === "admin"
      ? "admin"
      : "signedIn";

  return NextResponse.json(
    { state },
    { headers: { "cache-control": "private, no-store" } },
  );
}

/**
 * Terminate the caller's session.
 *
 * Runs on the server so the refresh token is revoked and the httpOnly auth
 * cookies are expired before the browser navigates away. The endpoint is
 * cookie-scoped (Supabase auth cookies are SameSite=Lax, so a cross-site
 * request carries none) and additionally rejects cross-site callers.
 */
export async function POST(request: Request) {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") {
    return NextResponse.json(
      { error: "Cross-site sign-out is not allowed." },
      { status: 403 },
    );
  }

  const origin = request.headers.get("origin");
  if (origin) {
    const host = request.headers.get("host");
    try {
      if (new URL(origin).host !== host) {
        return NextResponse.json(
          { error: "Cross-site sign-out is not allowed." },
          { status: 403 },
        );
      }
    } catch {
      return NextResponse.json(
        { error: "Malformed origin header." },
        { status: 403 },
      );
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();

  return NextResponse.json(
    { ok: !error },
    { status: error ? 500 : 200, headers: { "cache-control": "private, no-store" } },
  );
}

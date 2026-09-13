import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { getPublicKey } from "@/lib/supabase/key";

/**
 * OAuth callback route. Supabase redirects here after the user completes
 * Google (or any other) OAuth consent. This route exchanges the auth code
 * for a session and sets the cookies, then redirects the user to the
 * appropriate destination.
 *
 * @see https://supabase.com/docs/guides/auth/social-login/auth-google?queryGroups=framework&framework=nextjs&platform=nextjs
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // Only ever redirect to a local path. Reject protocol-relative or
  // external `next` values to prevent open-redirect abuse.
  const rawNext = searchParams.get("next") ?? "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//")
    ? rawNext
    : "/";

  if (error) {
    const message = errorDescription || error;
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(message)}`,
    );
  }

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      getPublicKey(),
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options),
              );
            } catch {
              // Called from a Server Component; safe to ignore when middleware
              // refreshes sessions.
            }
          },
        },
      },
    );

    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (!exchangeError) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent("Authentication failed. Please try again.")}`,
  );
}

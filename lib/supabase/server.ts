import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import type { Database } from "./types";

import { getPublicKey } from "./key";

/**
 * Cookie-less public Supabase client.
 *
 * Uses the public publishable key with no auth session, so requests run in the
 * `anon` role and RLS narrows access to public (active) rows. Because it never
 * touches request cookies, it is safe to use inside statically-generated
 * storefront Server Components.
 */
export function createPublicClient() {
  return createSupabaseJsClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    getPublicKey(),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

/**
 * Server-side Supabase client bound to the current request cookies.
 *
 * This client is RLS-aware and must be used for normal user-scoped
 * operations. It must NEVER be used to bypass RLS or access data outside
 * the requesting user's authorization scope.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
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
}

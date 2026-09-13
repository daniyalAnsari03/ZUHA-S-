import { cache } from "react";

import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import type { Role } from "./roles";

export type AuthUser = {
  id: string;
  email: string | null;
  role: Role;
};

/**
 * Returns the currently authenticated user with their role, or null if not
 * authenticated. Cached per-request for Server Components.
 *
 * Uses a two-step approach:
 * 1. Query profiles table via RLS (preferred path).
 * 2. Fall back to the `is_admin()` SECURITY DEFINER RPC if the RLS query
 *    does not return a row — this handles edge cases where the session
 *    cookie is valid but `auth.uid()` does not resolve correctly in the
 *    server component context (e.g. proxy cookie propagation issue).
 */
export const getAuthUser = cache(async (): Promise<AuthUser | null> => {
  const supabase = await createSupabaseClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  let role: Role = "customer";

  // Primary path: query profiles via RLS.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const row = profile as { role?: string } | null;

  if (row?.role === "admin") {
    role = "admin";
  }

  // Fallback: if the RLS query returned no row for an authenticated user,
  // use the SECURITY DEFINER is_admin() RPC which bypasses RLS. This
  // covers cases where auth.uid() doesn't resolve correctly in the server
  // component context (RLS returns null with no error when auth.uid()
  // is NULL).
  if (!row) {
    const { data: adminCheck } = await supabase.rpc("is_admin", {
      uid: user.id,
    });

    if (adminCheck === true) {
      role = "admin";
    }
  }

  return {
    id: user.id,
    email: user.email ?? null,
    role,
  };
});

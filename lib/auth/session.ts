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

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const row = profile as { role?: string } | null;

  if (row?.role === "admin") {
    role = "admin";
  }

  return {
    id: user.id,
    email: user.email ?? null,
    role,
  };
});

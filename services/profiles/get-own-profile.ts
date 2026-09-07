import { createClient as createSupabaseClient } from "@/lib/supabase/server";

/**
 * Profile service.
 *
 * Follows the service-layer pattern:
 *   Server Action → Validation → Authorization → Service → Supabase
 *
 * This example reads only the requesting user's own profile through the
 * RLS-aware client. It never bypasses RLS and never returns another user's
 * data.
 */
export async function getOwnProfile(authUserId: string) {
  const supabase = await createSupabaseClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", authUserId)
    .maybeSingle();

  if (error) {
    throw new Error("Failed to load profile.");
  }

  return data;
}

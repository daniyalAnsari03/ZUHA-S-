import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { ServiceError } from "@/services/base";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export type ProfileUpdateInput = {
  full_name?: string;
  phone?: string;
  address?: string;
  city?: string;
  postal_code?: string;
};

/** Update the current user's own profile. Only allows safe fields. */
export async function updateOwnProfile(
  userId: string,
  input: ProfileUpdateInput,
): Promise<ProfileRow> {
  const supabase = await createSupabaseClient();

  const { data, error } = await supabase
    .from("profiles")
    .update({
      full_name: input.full_name ?? undefined,
      phone: input.phone ?? undefined,
      address: input.address ?? undefined,
      city: input.city ?? undefined,
      postal_code: input.postal_code ?? undefined,
    })
    .eq("id", userId)
    .select("*")
    .single();

  if (error) {
    throw new ServiceError("PROFILE_UPDATE_FAILED", "Failed to update your profile.", error);
  }

  return data as ProfileRow;
}

/** Get a user's profile by ID. Uses RLS-aware client. */
export async function getProfile(userId: string): Promise<ProfileRow | null> {
  const supabase = await createSupabaseClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new ServiceError("PROFILE_READ_FAILED", "Failed to load profile.", error);
  }

  return data as ProfileRow | null;
}

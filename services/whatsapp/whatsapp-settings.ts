import { createAdminClient } from "@/lib/supabase/admin";
import { ServiceError } from "@/services/base";

export type WhatsappSettingsRow = {
  id: boolean;
  phone_number_id: string | null;
  display_phone: string | null;
  business_name: string | null;
  require_approval_for_send: boolean;
  created_at: string;
  updated_at: string;
};

/** Read the single settings row (created by migration 00019). */
export async function getWhatsappSettings(): Promise<WhatsappSettingsRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("whatsapp_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();

  if (error) {
    throw new ServiceError(
      "WHATSAPP_SETTINGS_READ_FAILED",
      "Failed to load WhatsApp settings.",
      error,
    );
  }
  return data ? (data as WhatsappSettingsRow) : null;
}

export type UpdateWhatsappSettingsInput = {
  phoneNumberId?: string | null;
  displayPhone?: string | null;
  businessName?: string | null;
  requireApprovalForSend?: boolean;
};

/** Update safe (non-secret) settings fields. */
export async function updateWhatsappSettings(
  input: UpdateWhatsappSettingsInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("whatsapp_settings")
    .upsert({
      id: true,
      phone_number_id: input.phoneNumberId ?? null,
      display_phone: input.displayPhone ?? null,
      business_name: input.businessName ?? null,
      require_approval_for_send: input.requireApprovalForSend ?? true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", true);

  if (error) {
    return { ok: false, error: "Failed to update WhatsApp settings." };
  }
  return { ok: true };
}
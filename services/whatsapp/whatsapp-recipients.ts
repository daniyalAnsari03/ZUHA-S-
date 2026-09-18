import { createAdminClient } from "@/lib/supabase/admin";
import { ServiceError } from "@/services/base";
import { normalizePhone } from "./whatsapp-service";
import type {
  WhatsAppRecipientRow,
  WhatsAppRecipientType,
} from "./types";

/**
 * Approved-recipient resolution.
 *
 * WhatsApp actions may ONLY target recipients that exist in `whatsapp_recipients`
 * and are active. An arbitrary phone number supplied by an AI or a customer is
 * always rejected — the recipient list is the trust boundary.
 */

export async function listApprovedRecipients(input?: {
  onlyActive?: boolean;
  type?: WhatsAppRecipientType;
}): Promise<WhatsAppRecipientRow[]> {
  const supabase = createAdminClient();
  let query = supabase.from("whatsapp_recipients").select("*");

  if (input?.type) query = query.eq("recipient_type", input.type);
  if (input?.onlyActive) query = query.eq("is_active", true);

  query = query.order("created_at", { ascending: false });

  const { data, error } = await query;
  if (error) {
    throw new ServiceError(
      "WHATSAPP_RECIPIENT_READ_FAILED",
      "Failed to load WhatsApp recipients.",
      error,
    );
  }
  return (data ?? []) as WhatsAppRecipientRow[];
}

/**
 * Resolve a single approved recipient by phone number. Returns null when the
 * number is not a valid/known/active recipient — callers treat null as
 * unauthorized and must never fall back to guessing.
 */
export async function resolveApprovedRecipient(
  rawPhone: string,
  type: WhatsAppRecipientType,
): Promise<WhatsAppRecipientRow | null> {
  const phone = normalizePhone(rawPhone);
  if (!phone) return null;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("whatsapp_recipients")
    .select("*")
    .eq("phone", phone)
    .eq("recipient_type", type)
    .eq("is_active", true)
    .maybeSingle();

  if (error) return null;
  return data ? (data as WhatsAppRecipientRow) : null;
}

export type CreateRecipientInput = {
  label: string;
  phone: string;
  recipientType?: WhatsAppRecipientType;
  userId?: string | null;
  isActive?: boolean;
};

/**
 * Validate + create a recipient. The phone number is normalized before insert
 * so lookups always match. Invalid numbers are rejected before any write.
 */
export async function createWhatsAppRecipient(
  input: CreateRecipientInput,
): Promise<{ ok: true; recipient: WhatsAppRecipientRow } | { ok: false; error: string }> {
  const phone = normalizePhone(input.phone);
  if (!phone) {
    return { ok: false, error: "Please provide a valid phone number." };
  }
  const label = input.label?.trim();
  if (!label) {
    return { ok: false, error: "Please provide a label for this recipient." };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("whatsapp_recipients")
    .insert({
      label,
      phone,
      recipient_type: input.recipientType ?? "admin",
      user_id: input.userId ?? null,
      is_active: input.isActive ?? true,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "This phone number is already a recipient." };
    }
    return { ok: false, error: "Failed to add the recipient. Please try again." };
  }

  return { ok: true, recipient: data as WhatsAppRecipientRow };
}

/** Toggle a recipient active/inactive. */
export async function setRecipientActive(
  recipientId: string,
  isActive: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("whatsapp_recipients")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", recipientId);

  if (error) {
    return { ok: false, error: "Failed to update the recipient." };
  }
  return { ok: true };
}

/** Remove a recipient entry entirely. */
export async function deleteWhatsAppRecipient(
  recipientId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("whatsapp_recipients")
    .delete()
    .eq("id", recipientId);

  if (error) {
    return { ok: false, error: "Failed to remove the recipient." };
  }
  return { ok: true };
}
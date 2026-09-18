import type { Database } from "@/lib/supabase/types";

export type WhatsappMessageStatus =
  Database["public"]["Tables"]["whatsapp_messages"]["Row"]["status"];

export type WhatsAppRecipientType = "admin" | "customer";

export type WhatsAppRecipientRow = {
  id: string;
  label: string;
  phone: string;
  recipient_type: WhatsAppRecipientType;
  user_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

/** Canonical event types we extract from inbound webhook payloads. */
export type WhatsAppEventType = "message" | "status" | "unknown";

export type ParsedInboundMessage = {
  providerEventId: string;
  eventType: WhatsAppEventType;
  from: string | null;
  profileName: string | null;
  text: string | null;
  phoneNumberId: string | null;
  payload: Record<string, unknown>;
};
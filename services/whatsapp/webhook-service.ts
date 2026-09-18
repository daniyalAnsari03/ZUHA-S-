import { createHmac, timingSafeEqual } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";
import type {
  ParsedInboundMessage,
  WhatsAppEventType,
} from "./types";

/**
 * WhatsApp Cloud API webhook payload handling.
 *
 * Responsibilities:
 *   - parse a raw webhook body into discrete events (messages + statuses)
 *   - verify the X-Hub-Signature-256 header (HMAC-SHA256 of the raw body)
 *   - journal events with a unique provider_event_id for idempotency
 */

export type ParsedWebhookEvent = {
  providerEventId: string;
  eventType: WhatsAppEventType;
  eventIndex: number;
  message: ParsedInboundMessage | null;
};

type RawValue = {
  messaging_product?: string;
  metadata?: { phone_number_id?: string | null; display_phone_number?: string | null };
  contacts?: Array<{ profile?: { name?: string | null } | null; wa_id?: string | null } | null>;
  messages?: Array<
    | {
        id?: string | null;
        from?: string | null;
        type?: string | null;
        timestamp?: string | null;
        text?: { body?: string | null } | null;
      }
    | null
  >;
  statuses?: Array<{ id?: string | null; status?: string | null } | null>;
};

/* ---------------------------------------------------------------------------
 * Signature verification
 * --------------------------------------------------------------------- */

/**
 * Verify the X-Hub-Signature-256 header for a raw body using the WhatsApp app
 * secret. Accepts the bare hex digest or a `sha256=<hex>` prefixed value.
 * Constant-time comparison prevents timing side-channels.
 */
export function verifyWhatsAppSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string | null,
): boolean {
  if (!signatureHeader || !appSecret) return false;

  const expected = createHmac("sha256", appSecret)
    .update(rawBody, "utf8")
    .digest("hex");

  const presented = signatureHeader.startsWith("sha256=")
    ? signatureHeader.slice("sha256=".length)
    : signatureHeader;

  const a = Buffer.from(presented, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}

/* ---------------------------------------------------------------------------
 * Payload parsing
 * --------------------------------------------------------------------- */

/** Deterministic fallback id for events that lack a natural provider id. */
function fallbackEventId(seed: string): string {
  return createHmac("sha256", "dins-whatsapp-webhook")
    .update(seed)
    .digest("hex")
    .slice(0, 40);
}

function parseMessage(
  value: RawValue,
  rawMessage: NonNullable<NonNullable<RawValue["messages"]>[number]>,
  eventIndex: number,
): ParsedInboundMessage {
  const profileName = value.contacts?.[0]?.profile?.name ?? null;
  return {
    providerEventId: rawMessage.id ?? fallbackEventId(`msg:${eventIndex}:${rawMessage.from ?? ""}`),
    eventType: "message",
    from: rawMessage.from ?? null,
    profileName,
    text: rawMessage.text?.body ?? null,
    phoneNumberId: value.metadata?.phone_number_id ?? null,
    payload: { raw: { ...rawMessage, text: rawMessage.text?.body ?? null } } as unknown as Record<string, unknown>,
  };
}

/**
 * Parse a decoded webhook body into discrete journal-able events. Returns an
 * empty array for malformed/unrelated payloads.
 */
export function parseWebhookPayload(body: unknown): ParsedWebhookEvent[] {
  const events: ParsedWebhookEvent[] = [];

  if (!body || typeof body !== "object") return events;

  const root = body as { entry?: Array<{ changes?: Array<{ field?: string; value?: RawValue }> } | null> | null };
  const entries = Array.isArray(root.entry) ? root.entry : [];

  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      if (change?.field !== "messages" || !change.value) continue;

      const value = change.value;
      const phoneNumberId = value.metadata?.phone_number_id ?? null;

      const messages = Array.isArray(value.messages) ? value.messages : [];
      for (let index = 0; index < messages.length; index += 1) {
        const rawMessage = messages[index];
        if (!rawMessage) continue;
        const message = parseMessage(value, rawMessage, index);
        events.push({
          providerEventId: message.providerEventId,
          eventType: message.eventType,
          eventIndex: index,
          message,
        });
      }

      const statuses = Array.isArray(value.statuses) ? value.statuses : [];
      for (let index = 0; index < statuses.length; index += 1) {
        const rawStatus = statuses[index];
        if (!rawStatus) continue;
        // Statuses without a provider id cannot be tracked — skip them.
        if (!rawStatus.id) continue;

        // Only `failed` statuses are journaled as actionable events. Non-failed
        // statuses (sent/delivered/read) are acknowledged and applied directly
        // to outbound messages via recordProviderStatus without journaling.
        if (rawStatus.status !== "failed") continue;

        events.push({
          providerEventId: rawStatus.id,
          eventType: "status",
          eventIndex: index,
          message: {
            providerEventId: rawStatus.id,
            eventType: "status",
            from: null,
            profileName: null,
            text: null,
            phoneNumberId,
            payload: { status: rawStatus.status },
          },
        });
      }
    }
  }

  return events;
}

/* ---------------------------------------------------------------------------
 * Event journal (idempotency)
 * --------------------------------------------------------------------- */

export function isOutOfBusinessScope(
  event: ParsedWebhookEvent,
  configuredPhoneNumberId: string | null,
): boolean {
  if (
    configuredPhoneNumberId &&
    event.message?.phoneNumberId &&
    event.message.phoneNumberId !== configuredPhoneNumberId
  ) {
    return true;
  }
  return false;
}

/**
 * Record an inbound event in the journal. Returns `{ inserted: true }` when the
 * event is new, or `{ inserted: false, existingStatus }` for a duplicate —
 * the unique provider_event_id constraint makes retried webhooks harmless.
 */
export async function recordWebhookEvent(input: {
  providerEventId: string;
  eventType: WhatsAppEventType;
  phoneNumberId: string | null;
  senderPhone: string | null;
  payload: Record<string, unknown>;
  status?: "received" | "processed" | "ignored" | "failed" | "duplicate";
  errorMessage?: string | null;
}): Promise<{ inserted: boolean; id: string | null; existingStatus?: string }> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("whatsapp_webhook_events")
    .insert({
      provider_event_id: input.providerEventId,
      event_type: input.eventType,
      status: input.status ?? "received",
      phone_number_id: input.phoneNumberId ?? null,
      sender_phone: input.senderPhone ?? null,
      payload: (input.payload ?? {}) as Json,
      error_message: input.errorMessage ?? null,
      created_at: now,
      processed_at: input.status === "processed" ? now : null,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      const { data: existing } = await supabase
        .from("whatsapp_webhook_events")
        .select("id, status")
        .eq("provider_event_id", input.providerEventId)
        .maybeSingle();
      return {
        inserted: false,
        id: existing?.id ?? null,
        existingStatus: existing?.status,
      };
    }
    console.error("[whatsapp-webhook] event journal failed:", error.message);
    return { inserted: false, id: null };
  }

  return { inserted: true, id: data?.id ?? null };
}

/** Mark a previously recorded event processed/ignored/failed. */
export async function updateWebhookEventStatus(
  providerEventId: string,
  status: "processed" | "ignored" | "failed",
  errorMessage?: string | null,
): Promise<void> {
  try {
    const supabase = createAdminClient();
    await supabase
      .from("whatsapp_webhook_events")
      .update({
        status,
        error_message: errorMessage ?? null,
        processed_at: new Date().toISOString(),
      })
      .eq("provider_event_id", providerEventId);
  } catch {
    // Best-effort journaling — never fails the webhook response.
  }
}
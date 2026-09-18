import { createAdminClient } from "@/lib/supabase/admin";
import { getWhatsappConfig, messageEndpoint } from "./config";
import type { WhatsappMessageStatus } from "./types";

/**
 * Provider status values surfaced by WhatsApp status webhooks that map to the
 * canonical `whatsapp_messages.status` set.
 */
const STATUS_MAP: Record<string, WhatsappMessageStatus | undefined> = {
  sent: "sent",
  delivered: "delivered",
  read: "read",
  failed: "failed",
};

/**
 * Normalize a phone number to an international-ish E.164 representation
 * (digits only, Pakistan default) so recipient matching is consistent.
 * Accepts "+92 300 1234567", "03001234567", "923001234567" etc.
 */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d]/g, "").replace(/^00/, "");
  if (digits.length < 10 || digits.length > 13) return null;

  if (digits.startsWith("0")) {
    return "92" + digits.slice(1);
  }
  if (digits.startsWith("92")) {
    return digits;
  }
  if (digits.length === 10) {
    return "92" + digits;
  }
  return null;
}

type MessageRow = {
  id: string;
  status: WhatsappMessageStatus;
};

/** Load an outbound message row by its server-generated idempotency key. */
async function findByIdempotencyKey(
  key: string,
): Promise<MessageRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("whatsapp_messages")
    .select("id, status")
    .eq("idempotency_key", key)
    .maybeSingle();

  if (error) return null;
  return data ? ({ id: data.id, status: data.status } as MessageRow) : null;
}

const DONE_STATUSES: ReadonlyArray<WhatsappMessageStatus> = [
  "sent",
  "delivered",
  "read",
];

/**
 * Send a WhatsApp text message through the Cloud API.
 *
 * Idempotency: every call resolves to one `whatsapp_messages` row keyed by
 * `idempotency_key`. A message already sent/delivered/read is never re-sent.
 * A previously failed message may be retried within its TTL.
 *
 * Honesty: when the provider is not configured (`isApiConfigured` false) the
 * call FAILS and the row is marked `rejected` — success is never faked.
 */
export async function sendWhatsAppText(input: {
  to: string;
  toLabel?: string | null;
  content: string;
  idempotencyKey?: string;
  requestedByUserId?: string | null;
  guardianDecisionId?: string | null;
  fetchFn?: typeof fetch;
}): Promise<
  | {
      ok: true;
      messageId: string;
      status: "sent";
      providerMessageId: string | null;
      alreadySent: boolean;
    }
  | {
      ok: false;
      messageId: string | null;
      status: "rejected" | "failed" | "not_configured";
      message: string;
      retryable: boolean;
      providerCode?: string;
    }
> {
  const phone = normalizePhone(input.to);
  if (!phone) {
    return {
      ok: false,
      messageId: null,
      status: "rejected",
      message: "Invalid phone number format.",
      retryable: false,
    };
  }

  const content = input.content?.trim();
  if (!content) {
    return {
      ok: false,
      messageId: null,
      status: "rejected",
      message: "Message content cannot be empty.",
      retryable: false,
    };
  }

  const config = getWhatsappConfig();
  const idempotencyKey =
    input.idempotencyKey ?? `out-${globalThis.crypto.randomUUID()}`;

  // --- Resolve idempotency: never re-send an already-delivered message. ---
  const existing = await findByIdempotencyKey(idempotencyKey);
  if (existing && DONE_STATUSES.includes(existing.status)) {
    return {
      ok: true,
      messageId: existing.id,
      status: "sent",
      providerMessageId: null,
      alreadySent: true,
    };
  }

  const now = new Date().toISOString();
  const supabase = createAdminClient();

  // --- Insert (or reuse) the outbound row keyed by idempotency_key. ---
  let rowId: string;
  const insertResult = await supabase
    .from("whatsapp_messages")
    .insert({
      idempotency_key: idempotencyKey,
      recipient_phone: phone,
      recipient_label: input.toLabel ?? null,
      content,
      message_type: "text",
      direction: "outbound",
      status: "queued",
      requested_by_user_id: input.requestedByUserId ?? null,
      guardian_decision_id: input.guardianDecisionId ?? null,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();

  if (insertResult.error) {
    if (insertResult.error.code === "23505") {
      const existingRow = await findByIdempotencyKey(idempotencyKey);
      if (existingRow) {
        if (DONE_STATUSES.includes(existingRow.status)) {
          return {
            ok: true,
            messageId: existingRow.id,
            status: "sent",
            providerMessageId: null,
            alreadySent: true,
          };
        }
        rowId = existingRow.id;
      } else {
        return {
          ok: false,
          messageId: null,
          status: "failed",
          message: "Could not reserve the outbound message slot.",
          retryable: true,
        };
      }
    } else {
      return {
        ok: false,
        messageId: null,
        status: "failed",
        message: "Could not record the outbound message.",
        retryable: true,
      };
    }
  } else {
    rowId = insertResult.data.id;
  }

  const markError = async (
    status: WhatsappMessageStatus,
    errorCode: string | null,
    errorMessage: string,
  ) => {
    await supabase
      .from("whatsapp_messages")
      .update({ status, error_code: errorCode, error_message: errorMessage, updated_at: now })
      .eq("id", rowId);
  };

  // --- Not configured: fail honestly, never fake a send. ---
  const endpoint = messageEndpoint(config);
  if (!config.isApiConfigured || !endpoint) {
    await markError("rejected", "NOT_CONFIGURED", "WhatsApp API is not configured.");
    return {
      ok: false,
      messageId: rowId,
      status: "not_configured",
      message:
        "WhatsApp is not configured yet, so the message was not sent. Add WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID to enable outbound WhatsApp.",
      retryable: false,
    };
  }

  // --- Provider call with a bounded timeout. ---
  const fetchFn = input.fetchFn ?? globalThis.fetch.bind(globalThis);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetchFn(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: phone,
        type: "text",
        text: { body: content },
      }),
      signal: controller.signal,
    });

    if (response.ok) {
      const payload = (await response.json()) as {
        messages?: Array<{ id?: string }>;
      };
      const providerMessageId = payload.messages?.[0]?.id ?? null;
      await supabase
        .from("whatsapp_messages")
        .update({
          status: "sent",
          provider_message_id: providerMessageId,
          error_code: null,
          error_message: null,
          sent_at: now,
          updated_at: now,
        })
        .eq("id", rowId);

      return {
        ok: true,
        messageId: rowId,
        status: "sent",
        providerMessageId,
        alreadySent: false,
      };
    }

    // Surface a safe, bounded provider error — never raw bodies to customers.
    const errorBody = (await response.json().catch(() => null)) as {
      error?: { message?: string; code?: number | string } | null;
    } | null;
    const providerMessage =
      errorBody?.error?.message ?? `Provider returned HTTP ${response.status}.`;
    const providerCode = String(
      errorBody?.error?.code ?? response.status,
    );
    const retryable = response.status >= 500 || response.status === 429;

    await markError("failed", providerCode, providerMessage.slice(0, 500));
    return {
      ok: false,
      messageId: rowId,
      status: "failed",
      message: retryable
        ? "The message could not be sent right now. You can retry shortly."
        : "The message could not be sent. Please check the WhatsApp configuration.",
      retryable,
      providerCode,
    };
  } catch (error) {
    const isAbort = error instanceof Error && error.name === "AbortError";
    const message = isAbort
      ? "The WhatsApp request timed out."
      : "The WhatsApp request failed.";
    await markError("failed", isAbort ? "TIMEOUT" : "NETWORK_ERROR", message);
    return {
      ok: false,
      messageId: rowId,
      status: "failed",
      message: "The WhatsApp service is temporarily unavailable. Please retry shortly.",
      retryable: true,
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Apply a provider status update (from a status webhook) to a tracked outbound
 * message. Unknown/unsupported statuses are ignored. Never downgrades a message
 * (e.g. a `read` stays read).
 */
export async function recordProviderStatus(input: {
  providerMessageId: string;
  providerStatus: string;
}): Promise<void> {
  const status = STATUS_MAP[input.providerStatus];
  if (!status) return;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("whatsapp_messages")
    .select("id, status, provider_message_id")
    .eq("provider_message_id", input.providerMessageId)
    .maybeSingle();

  if (error || !data) return;

  // Never downgrade: only move forward sent → delivered → read.
  const order = { sent: 0, delivered: 1, read: 2 } as const;
  const current = order[data.status as keyof typeof order];
  const next = order[status as keyof typeof order];
  if (current === undefined || next <= (current ?? 0)) return;

  await supabase
    .from("whatsapp_messages")
    .update({ status, provider_status: input.providerStatus, updated_at: new Date().toISOString() })
    .eq("id", data.id);
}
import { NextResponse } from "next/server";

import { getWhatsappConfig } from "@/services/whatsapp/config";
import { processInboundMessage } from "@/services/whatsapp/whatsapp-ai-service";
import { recordProviderStatus } from "@/services/whatsapp/whatsapp-service";
import {
  isOutOfBusinessScope,
  parseWebhookPayload,
  recordWebhookEvent,
  updateWebhookEventStatus,
  verifyWhatsAppSignature,
} from "@/services/whatsapp/webhook-service";

export const runtime = "nodejs";

/**
 * WhatsApp Cloud API webhook.
 *
 * MUST ALWAYS return 200 to the provider (even for ignored/invalid events) so
 * the provider never retries a decision we already made — all security
 * decisions are journaled in `whatsapp_webhook_events` (idempotent by
 * `provider_event_id`).
 */

// GET — provider subscription verification.
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const config = getWhatsappConfig();

  if (mode === "subscribe" && token && token === config.verifyToken) {
    return new Response(challenge ?? "ok", { status: 200 });
  }

  return new Response("Verification failed. Invalid hub verification token.", {
    status: 403,
  });
}

// POST — event delivery + status updates.
export async function POST(request: Request): Promise<Response> {
  const config = getWhatsappConfig();
  const rawBody = await request.text();

  // Signature verification: required when WHATSAPP_APP_SECRET is configured.
  if (config.signatureVerificationEnabled) {
    const signature = request.headers.get("x-hub-signature-256");
    const valid = verifyWhatsAppSignature(
      rawBody,
      signature,
      config.appSecret,
    );
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid signature." },
        { status: 401 },
      );
    }
  } else {
    console.warn(
      "[whatsapp-webhook] WHATSAPP_APP_SECRET not configured — skipping payload signature verification.",
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  const events = parseWebhookPayload(body);

  for (const event of events) {
    const outOfScope = isOutOfBusinessScope(
      event,
      config.phoneNumberId,
    );
    if (outOfScope) {
      await recordWebhookEvent({
        providerEventId: event.providerEventId,
        eventType: event.eventType,
        phoneNumberId: event.message?.phoneNumberId ?? null,
        senderPhone: event.message?.from ?? null,
        payload: event.message?.payload ?? {},
        status: "ignored",
        errorMessage: "Event for a different WhatsApp business number.",
      });
      continue;
    }

    const journal = await recordWebhookEvent({
      providerEventId: event.providerEventId,
      eventType: event.eventType,
      phoneNumberId: event.message?.phoneNumberId ?? null,
      senderPhone: event.message?.from ?? null,
      payload: event.message?.payload ?? {},
      status: "received",
    });

    // Duplicate delivery (provider retry) — already handled, never re-process.
    if (!journal.inserted) {
      await updateWebhookEventStatus(event.providerEventId, "ignored", "Duplicate delivery.");
      continue;
    }

    if (event.eventType === "message") {
      const outcome = await processInboundMessage(event);
      if (outcome.handled === "processed") {
        await updateWebhookEventStatus(event.providerEventId, "processed");
      } else if (outcome.handled === "failed") {
        await updateWebhookEventStatus(
          event.providerEventId,
          "failed",
          outcome.reason,
        );
      } else {
        await updateWebhookEventStatus(
          event.providerEventId,
          "ignored",
          outcome.reason,
        );
      }
    } else if (event.eventType === "status") {
      // Journaled failed status is acknowledged without business side-effects.
      await updateWebhookEventStatus(event.providerEventId, "processed");
    } else {
      await updateWebhookEventStatus(
        event.providerEventId,
        "ignored",
        "Unknown event type.",
      );
    }
  }

  // Non-failed statuses (sent/delivered/read) are applied to tracked outbound
  // messages without requiring a journaled event.
  for (const entry of ((body as { entry?: Array<{ changes?: Array<{ value?: { statuses?: Array<{ id?: string; status?: string }> } }> }> } | undefined)?.entry) ??
    []) {
    for (const change of entry.changes ?? []) {
      for (const status of change.value?.statuses ?? []) {
        if (status.id && status.status) {
          await recordProviderStatus({
            providerMessageId: status.id,
            providerStatus: status.status,
          });
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}
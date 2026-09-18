import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  isOutOfBusinessScope,
  parseWebhookPayload,
  verifyWhatsAppSignature,
  type ParsedWebhookEvent,
} from "@/services/whatsapp/webhook-service";

/**
 * WhatsApp webhook parsing + signature verification. Pure functions — the
 * event journal (recordWebhookEvent) touches the database and is exercised
 * elsewhere.
 */

const APP_SECRET = "test-app-secret";

function hmacSha256(raw: string, secret = APP_SECRET): string {
  return createHmac("sha256", secret).update(raw, "utf8").digest("hex");
}

function messagePayload(overrides: Record<string, unknown> = {}) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "wb-1",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "15550123456", phone_number_id: "111" },
              contacts: [{ profile: { name: "Ali Malik" }, wa_id: "923001234567" }],
              messages: [
                {
                  from: "923001234567",
                  id: "wamid.inbound.1",
                  timestamp: "1758500000",
                  text: { body: "Salaam, kitna stock hai?" },
                  type: "text",
                },
              ],
            },
          },
        ],
      },
    ],
    ...overrides,
  };
}

function statusPingPayload(overrides: Record<string, unknown> = {}) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "wb-1",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "15550123456", phone_number_id: "111" },
              statuses: [
                { id: "wamid.outbound.1", status: "delivered", timestamp: "1758500001" },
              ],
            },
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe("verifyWhatsAppSignature", () => {
  const rawBody = JSON.stringify(messagePayload());

  it("accepts a valid bare hex signature", () => {
    expect(verifyWhatsAppSignature(rawBody, hmacSha256(rawBody), APP_SECRET)).toBe(true);
  });

  it("accepts a valid sha256= prefixed signature (the documented format)", () => {
    expect(verifyWhatsAppSignature(rawBody, `sha256=${hmacSha256(rawBody)}`, APP_SECRET)).toBe(true);
  });

  it("rejects a tampered body", () => {
    const tampered = JSON.stringify(messagePayload({ object: "attacker" }));
    expect(verifyWhatsAppSignature(tampered, hmacSha256(rawBody), APP_SECRET)).toBe(false);
  });

  it("rejects mismatched lengths and non-hex input without throwing", () => {
    expect(verifyWhatsAppSignature(rawBody, "abc", APP_SECRET)).toBe(false);
    expect(verifyWhatsAppSignature(rawBody, "not-hex!", APP_SECRET)).toBe(false);
  });

  it("rejects missing signature or missing secret", () => {
    expect(verifyWhatsAppSignature(rawBody, null, APP_SECRET)).toBe(false);
    expect(verifyWhatsAppSignature(rawBody, hmacSha256(rawBody), null)).toBe(false);
  });
});

describe("parseWebhookPayload", () => {
  it("extracts an inbound text message with sender details", () => {
    const events = parseWebhookPayload(messagePayload());
    expect(events).toHaveLength(1);
    const event = events[0];
    expect(event.eventType).toBe("message");
    expect(event.providerEventId).toBe("wamid.inbound.1");
    expect(event.message).toMatchObject({
      from: "923001234567",
      profileName: "Ali Malik",
      text: "Salaam, kitna stock hai?",
      phoneNumberId: "111",
    });
  });

  it("falls back to a deterministic id when the provider omits a message id", () => {
    const payload = messagePayload();
    const raw = payload.entry[0].changes[0].value.messages[0];
    (raw as { id: string | null }).id = null;
    const events = parseWebhookPayload(payload);
    expect(events[0].providerEventId).toMatch(/^[a-f0-9]{40}$/);
  });

  it("journal only failed statuses and ignores sent/delivered/read", () => {
    expect(parseWebhookPayload(statusPingPayload())).toHaveLength(0);

    const failed = statusPingPayload();
    failed.entry[0].changes[0].value.statuses[0].status = "failed";
    const events = parseWebhookPayload(failed);
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("status");
    expect(events[0].providerEventId).toBe("wamid.outbound.1");
  });

  it("returns an empty array for unrelated or malformed payloads", () => {
    expect(parseWebhookPayload(null)).toEqual([]);
    expect(parseWebhookPayload({ object: "other" })).toEqual([]);
    expect(parseWebhookPayload(undefined)).toEqual([]);
    expect(parseWebhookPayload("string")).toEqual([]);
    expect(parseWebhookPayload([])).toEqual([]);
  });

  it("ignores changes on unrecognized fields", () => {
    const payload = messagePayload();
    payload.entry[0].changes[0].field = "account_review";
    expect(parseWebhookPayload(payload)).toEqual([]);
  });
});

describe("isOutOfBusinessScope", () => {
  const event: ParsedWebhookEvent = {
    providerEventId: "wamid.inbound.1",
    eventType: "message",
    eventIndex: 0,
    message: {
      providerEventId: "wamid.inbound.1",
      eventType: "message",
      from: "923001234567",
      profileName: null,
      text: "hi",
      phoneNumberId: "111",
      payload: {},
    },
  };

  it("flags an event for a different phone_number_id", () => {
    expect(isOutOfBusinessScope(event, "999")).toBe(true);
  });

  it("accepts an event for the configured phone number", () => {
    expect(isOutOfBusinessScope(event, "111")).toBe(false);
  });

  it("accepts events when no phone number is configured", () => {
    expect(isOutOfBusinessScope(event, null)).toBe(false);
  });
});
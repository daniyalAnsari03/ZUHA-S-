import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

import { createClient as mockSupabaseCreateClient } from "@supabase/supabase-js";
import { sendWhatsAppText } from "@/services/whatsapp/whatsapp-service";

/**
 * sendWhatsAppText — outbound Cloud API behavior.
 *
 * Covered: input validation, idempotency (never re-send a delivered message),
 * honest not-configured failure, success path, bounded provider failure with
 * retry classification, and network/timeout handling. The supabase-js
 * createClient is stubbed so the real (data-access) admin client returns a
 * scripted query builder — only the observable send contract is asserted.
 */

type ReadResult = { data: unknown; error: { message: string } | null };

function makeFake(reads: ReadResult[]) {
  let readIndex = 0;
  const chainable = {
    eq: () => chainable,
    select: () => chainable,
    insert: () => chainable,
    update: () => chainable,
    maybeSingle: () =>
      Promise.resolve(
        reads[readIndex++] ?? { data: null, error: { message: "read fell off the queue" } },
      ),
    single: () =>
      Promise.resolve(
        reads[readIndex++] ?? { data: null, error: { message: "read fell off the queue" } },
      ),
  };
  return {
    from: () => chainable,
  };
}

const CONFIG_ENV_KEYS = [
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_WEBHOOK_VERIFY_TOKEN",
  "WHATSAPP_APP_SECRET",
];

function setEnv() {
  for (const key of CONFIG_ENV_KEYS) delete process.env[key];
  process.env.WHATSAPP_ACCESS_TOKEN = "test-token";
  process.env.WHATSAPP_PHONE_NUMBER_ID = "111";
  process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = "verify";
  process.env.WHATSAPP_APP_SECRET = "secret";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
}

function unsetEnv() {
  for (const key of CONFIG_ENV_KEYS) delete process.env[key];
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
}

describe("sendWhatsAppText", () => {
  beforeEach(() => {
    vi.mocked(mockSupabaseCreateClient).mockReset();
    setEnv();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    unsetEnv();
  });

  it("rejects an invalid phone number before any provider or database call", async () => {
    const result = await sendWhatsAppText({ to: "123", content: "hi" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe("rejected");
      expect(result.message).toMatch(/invalid phone/i);
    }
    expect(mockSupabaseCreateClient).not.toHaveBeenCalled();
  });

  it("rejects empty content", async () => {
    const result = await sendWhatsAppText({
      to: "923001234567",
      content: "   ",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe("rejected");
      expect(result.message).toMatch(/empty/i);
    }
    expect(mockSupabaseCreateClient).not.toHaveBeenCalled();
  });

  it("never fakes success when WhatsApp is not configured", async () => {
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    const fake = makeFake([
      { data: null, error: null },
      { data: { id: "row-1" }, error: null },
    ]);
    vi.mocked(mockSupabaseCreateClient).mockReturnValue(fake as never);

    const result = await sendWhatsAppText({
      to: "923001234567",
      content: "Salaam",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe("not_configured");
      expect(result.retryable).toBe(false);
      expect(result.message).toMatch(/not configured/i);
    }
  });

  it("sends and records a sent message for a configured provider", async () => {
    const fake = makeFake([
      { data: null, error: null },
      { data: { id: "row-1" }, error: null },
    ]);
    vi.mocked(mockSupabaseCreateClient).mockReturnValue(fake as never);

    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ messaging_product: "whatsapp", messages: [{ id: "wamid.1" }] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await sendWhatsAppText({
      to: "03001234567",
      content: "Salaam",
      idempotencyKey: "out-test-1",
      requestedByUserId: "admin-1",
      fetchFn,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result).toMatchObject({
        messageId: "row-1",
        status: "sent",
        providerMessageId: "wamid.1",
        alreadySent: false,
      });
      expect(fetchFn).toHaveBeenCalledWith(
        "https://graph.facebook.com/v21.0/111/messages",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer test-token",
          }),
        }),
      );
      const body = JSON.parse((fetchFn.mock.calls[0][1] as { body: string }).body);
      expect(body).toMatchObject({ to: "923001234567", type: "text" });
    }
  });

  it("does not re-send a message already delivered (idempotency)", async () => {
    const fake = makeFake([
      { data: { id: "row-9", status: "delivered" }, error: null },
    ]);
    vi.mocked(mockSupabaseCreateClient).mockReturnValue(fake as never);

    const fetchFn = vi.fn();
    const result = await sendWhatsAppText({
      to: "923001234567",
      content: "duplicate?",
      idempotencyKey: "out-already-sent",
      fetchFn,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.alreadySent).toBe(true);
      expect(result.messageId).toBe("row-9");
      expect(fetchFn).not.toHaveBeenCalled();
    }
  });

  it("surfaces a non-retryable provider failure (HTTP 400)", async () => {
    const fake = makeFake([
      { data: null, error: null },
      { data: { id: "row-2" }, error: null },
    ]);
    vi.mocked(mockSupabaseCreateClient).mockReturnValue(fake as never);

    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { message: "Invalid parameter", code: 131026 } }),
        { status: 400 },
      ),
    );

    const result = await sendWhatsAppText({
      to: "923001234567",
      content: "hi",
      fetchFn,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe("failed");
      expect(result.retryable).toBe(false);
      expect(result.providerCode).toBe("131026");
    }
  });

  it("classifies server errors (HTTP 500) as retryable", async () => {
    const fake = makeFake([
      { data: null, error: null },
      { data: { id: "row-3" }, error: null },
    ]);
    vi.mocked(mockSupabaseCreateClient).mockReturnValue(fake as never);

    const fetchFn = vi.fn().mockResolvedValue(new Response(null, { status: 500 }));
    const result = await sendWhatsAppText({ to: "923001234567", content: "hi", fetchFn });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe("failed");
      expect(result.retryable).toBe(true);
    }
  });

  it("treats network errors as retryable", async () => {
    const fake = makeFake([
      { data: null, error: null },
      { data: { id: "row-4" }, error: null },
    ]);
    vi.mocked(mockSupabaseCreateClient).mockReturnValue(fake as never);

    const fetchFn = vi.fn().mockRejectedValue(new Error("socket hang up"));
    const result = await sendWhatsAppText({ to: "923001234567", content: "hi", fetchFn });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe("failed");
      expect(result.retryable).toBe(true);
    }
  });
});
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/whatsapp/whatsapp-service", () => ({
  sendWhatsAppText: vi.fn(),
}));

vi.mock("@/services/whatsapp/whatsapp-reports", () => ({
  buildDailySalesReport: vi.fn(),
  buildLowStockReport: vi.fn(),
  buildOrdersReport: vi.fn(),
  reportToText: vi.fn(),
}));

import { executeApprovedWhatsappAction } from "@/tools/whatsapp-approval-executor";
import { sendWhatsAppText as mockSendWhatsAppText } from "@/services/whatsapp/whatsapp-service";

import type { Mock } from "vitest";

const mockSend = mockSendWhatsAppText as Mock;

/**
 * Approval executor — re-runs only the FROZEN execution payload.
 *
 * Verifies the approved action is executed with the exact captured recipient,
 * label, content and requester; unknown / incomplete payloads are rejected and
 * provider failures surface the real (bounded) error including the provider
 * code, so the admin is never shown the misleading generic approval error.
 */

describe("executeApprovedWhatsappAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockReset();
    mockSend.mockResolvedValue({
      ok: true,
      messageId: "msg-1",
      status: "sent",
      providerMessageId: null,
      alreadySent: false,
    });
  });

  it("rejects a payload with no recipient", async () => {
    const result = await executeApprovedWhatsappAction({
      kind: "whatsapp_message",
      content: "hello",
    });
    expect(result).toEqual({
      ok: false,
      error: "The approved action is missing its recipient.",
    });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("rejects a WhatsApp message with no content", async () => {
    const result = await executeApprovedWhatsappAction({
      kind: "whatsapp_message",
      recipientPhone: "923001234567",
      content: "   ",
    });
    expect(result).toEqual({
      ok: false,
      error: "The approved action has no message content.",
    });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("rejects an unsupported execution kind", async () => {
    const result = await executeApprovedWhatsappAction({
      kind: "execute_any_sql",
      recipientPhone: "923001234567",
    });
    expect(result).toEqual({
      ok: false,
      error: "The approved action is not a supported WhatsApp action.",
    });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("re-runs the exact frozen WhatsApp message payload", async () => {
    const result = await executeApprovedWhatsappAction({
      kind: "whatsapp_message",
      toolName: "send_whatsapp_message",
      recipientPhone: "923282241956",
      recipientLabel: "Owner",
      content: "Test message",
      requestedBy: "admin-1",
    });

    expect(result).toEqual({ ok: true, message: "Sent to Owner." });
    expect(mockSend).toHaveBeenCalledTimes(1);
    const call = mockSend.mock.calls[0][0];
    expect(call).toMatchObject({
      to: "923282241956",
      toLabel: "Owner",
      content: "Test message",
      requestedByUserId: "admin-1",
    });
    expect(call.idempotencyKey).toMatch(/^approved-/);
  });

  it("surfaces the provider failure with its provider code", async () => {
    mockSend.mockResolvedValue({
      ok: false,
      messageId: "msg-1",
      status: "failed",
      message: "The message could not be sent. Please check the WhatsApp configuration.",
      retryable: false,
      providerCode: "131030",
    });

    const result = await executeApprovedWhatsappAction({
      kind: "whatsapp_message",
      recipientPhone: "923282241956",
      recipientLabel: "Owner",
      content: "Test message",
    });

    expect(result).toEqual({
      ok: false,
      error:
        "The message could not be sent. Please check the WhatsApp configuration. (provider code: 131030)",
    });
  });

  it("surfaces a bounded provider failure without a code", async () => {
    mockSend.mockResolvedValue({
      ok: false,
      messageId: "msg-1",
      status: "failed",
      message: "The message could not be sent. Please check the WhatsApp configuration.",
      retryable: true,
    });

    const result = await executeApprovedWhatsappAction({
      kind: "whatsapp_message",
      recipientPhone: "923282241956",
      recipientLabel: "Owner",
      content: "Test message",
    });

    expect(result).toEqual({
      ok: false,
      error: "The message could not be sent. Please check the WhatsApp configuration.",
    });
  });
});
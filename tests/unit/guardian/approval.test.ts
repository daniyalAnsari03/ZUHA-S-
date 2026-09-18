import { describe, expect, it } from "vitest";

import {
  env,
  messageEndpoint,
  type WhatsappConfig,
} from "@/services/whatsapp/config";
import { normalizePhone } from "@/services/whatsapp/whatsapp-service";
import {
  validateApprovalForExecution,
  type ApprovalRequestRow,
} from "@/services/ai/approval-service";
import { buildContextHash } from "@/tools/shared/guarded";

/**
 * WhatsApp config + phone normalization, approval validity checks, and the
 * context-hash helper. Pure functions — no database, no fetch.
 */

function approvalRequest(
  overrides: Partial<ApprovalRequestRow> = {},
): ApprovalRequestRow {
  return {
    id: "apr-1",
    guardian_decision_id: "gd-1",
    user_id: "u-1",
    agent_name: "ai_manager",
    action_type: "send_whatsapp_message",
    risk: "medium",
    target_type: "whatsapp_message",
    target_id: null,
    summary: "Send a message",
    execution: { kind: "whatsapp_message" },
    context_hash: "abc123",
    status: "approved",
    requested_at: new Date().toISOString(),
    decided_by: "admin-1",
    decided_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    ...overrides,
  };
}

describe("normalizePhone", () => {
  it("normalizes a Pakistani local number with leading zero", () => {
    expect(normalizePhone("03001234567")).toBe("923001234567");
  });

  it("normalizes international formatting with + and spaces", () => {
    expect(normalizePhone("+92 300 1234567")).toBe("923001234567");
  });

  it("passes through a bare E.164 number", () => {
    expect(normalizePhone("923001234567")).toBe("923001234567");
  });

  it("drops a leading 00 prefix", () => {
    expect(normalizePhone("00923001234567")).toBe("923001234567");
  });

  it("treats a 10-digit (non-zero-prefixed) number as Pakistani", () => {
    expect(normalizePhone("3001234567")).toBe("923001234567");
  });

  it("rejects too-short, too-long, and invalid numbers", () => {
    expect(normalizePhone("123")).toBeNull();
    expect(normalizePhone("12345678901234")).toBeNull();
    expect(normalizePhone("abc")).toBeNull();
    expect(normalizePhone("")).toBeNull();
  });
});

describe("whatsapp config (env)", () => {
  it("flags a fully configured environment", () => {
    const config = env({
      WHATSAPP_ACCESS_TOKEN: "tok",
      WHATSAPP_PHONE_NUMBER_ID: "111",
      WHATSAPP_WEBHOOK_VERIFY_TOKEN: "tok2",
      WHATSAPP_APP_SECRET: "sec",
    });
    expect(config.isConfigured).toBe(true);
    expect(config.isApiConfigured).toBe(true);
    expect(config.signatureVerificationEnabled).toBe(true);
  });

  it("is not configured when any required value is missing", () => {
    const config = env({
      WHATSAPP_ACCESS_TOKEN: "tok",
      WHATSAPP_PHONE_NUMBER_ID: "111",
    });
    expect(config.isConfigured).toBe(false);
    expect(config.isApiConfigured).toBe(true);
    expect(config.signatureVerificationEnabled).toBe(false);
  });

  it("is not api-configured without a phone number id", () => {
    expect(env({ WHATSAPP_ACCESS_TOKEN: "tok" }).isApiConfigured).toBe(false);
  });

  it("defaults the API version when unset", () => {
    expect(env({}).apiVersion).toBe("v21.0");
  });
});

describe("messageEndpoint", () => {
  it("builds the Graph API messages URL when configured", () => {
    const config: WhatsappConfig = {
      isConfigured: true,
      isApiConfigured: true,
      signatureVerificationEnabled: false,
      accessToken: "tok",
      phoneNumberId: "111",
      verifyToken: null,
      appSecret: null,
      apiVersion: "v21.0",
    };
    expect(messageEndpoint(config)).toBe(
      "https://graph.facebook.com/v21.0/111/messages",
    );
  });

  it("returns null when outbound is not configured", () => {
    expect(
      messageEndpoint({
        isConfigured: false,
        isApiConfigured: false,
        signatureVerificationEnabled: false,
        accessToken: null,
        phoneNumberId: null,
        verifyToken: null,
        appSecret: null,
        apiVersion: "v21.0",
      }),
    ).toBeNull();
  });
});

describe("validateApprovalForExecution", () => {
  it("accepts an approved, unexpired request with matching context hash", () => {
    expect(validateApprovalForExecution(approvalRequest(), "abc123")).toEqual({
      ok: true,
    });
  });

  it("rejects a missing request", () => {
    const result = validateApprovalForExecution(null, "abc123");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/not found/i);
  });

  it("rejects a request that is not approved", () => {
    const request = approvalRequest({ status: "pending" });
    const result = validateApprovalForExecution(request, "abc123");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/not approved/i);
  });

  it("rejects an expired request", () => {
    const request = approvalRequest({
      expires_at: new Date(Date.now() - 1_000).toISOString(),
    });
    const result = validateApprovalForExecution(request, "abc123");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/expired/i);
  });

  it("rejects an invalid expires_at date", () => {
    const request = approvalRequest({ expires_at: "not-a-date" });
    expect(validateApprovalForExecution(request, "abc123").ok).toBe(false);
  });

  it("rejects a context hash that no longer matches the approved action", () => {
    const request = approvalRequest();
    const result = validateApprovalForExecution(request, "changed-hash");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/no longer match/i);
  });
});

describe("buildContextHash", () => {
  it("is deterministic for identical inputs", () => {
    const input = { tool: "send_whatsapp_message", to: "923001234567" };
    expect(buildContextHash(input)).toBe(buildContextHash(input));
    expect(buildContextHash(input)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("changes when an input detail changes", () => {
    expect(buildContextHash({ to: "923001234567" })).not.toBe(
      buildContextHash({ to: "923001234568" }),
    );
  });
});
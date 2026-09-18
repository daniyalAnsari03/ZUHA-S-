import { describe, expect, it } from "vitest";

import type { AgentContext } from "@/agents/context";
import { ACTION_POLICIES, evaluateAiAction } from "@/guardians/engine";

/**
 * Guardian engine tests — the pure fail-closed decision core.
 *
 * The engine must deny anything it does not explicitly know/support:
 * unknown tools, guests, and role mismatches all fall through to DENY.
 * Only explicitly allowed + authorized + not-approval-gated actions evaluate
 * to ALLOW. Approval gates must honor the store's `by_exception` flag.
 */

function contextWith(
  overrides: Partial<AgentContext> = {},
): AgentContext {
  return {
    userId: "u-admin",
    role: "admin",
    channel: "admin",
    requestId: "req-1",
    conversationId: "conv-1",
    ...overrides,
  };
}

describe("evaluateAiAction — policy registry", () => {
  it("covers the WhatsApp outbound tools as medium-risk admin actions", () => {
    expect(ACTION_POLICIES.send_whatsapp_message).toEqual({
      risk: "medium",
      allowedRoles: ["admin"],
      approval: "by_exception",
    });
    expect(ACTION_POLICIES.send_whatsapp_report).toEqual({
      risk: "medium",
      allowedRoles: ["admin"],
      approval: "by_exception",
    });
  });
});

describe("evaluateAiAction — fail closed", () => {
  it("denies a tool that is not registered in the policy registry", () => {
    const verdict = evaluateAiAction({
      context: contextWith(),
      toolName: "execute_any_sql",
    });
    expect(verdict.decision).toBe("deny");
    expect(verdict.risk).toBe("high");
    expect(verdict.reason).toMatch(/not registered with the Guardian/i);
  });

  it("denies guests even for admin-scoped reads", () => {
    const verdict = evaluateAiAction({
      context: contextWith({ role: null, userId: null }),
      toolName: "get_sales_overview",
    });
    expect(verdict.decision).toBe("deny");
  });

  it("denies customers for admin-only WhatsApp sends", () => {
    const verdict = evaluateAiAction({
      context: contextWith({ role: "customer" }),
      toolName: "send_whatsapp_message",
    });
    expect(verdict.decision).toBe("deny");
    expect(verdict.risk).toBe("medium");
  });

  it("denies an unknown role", () => {
    const verdict = evaluateAiAction({
      context: contextWith({ role: "superuser" as never }),
      toolName: "get_orders",
    });
    expect(verdict.decision).toBe("deny");
  });
});

describe("evaluateAiAction — allow vs approval", () => {
  it("allows an admin low-risk read when no approval is required", () => {
    const verdict = evaluateAiAction({
      context: contextWith(),
      toolName: "get_low_stock",
    });
    expect(verdict).toMatchObject({
      decision: "allow",
      risk: "low",
      requiresApproval: false,
    });
  });

  it("allows an admin WhatsApp send when the store does not require approval", () => {
    const verdict = evaluateAiAction({
      context: contextWith(),
      toolName: "send_whatsapp_message",
    });
    expect(verdict).toMatchObject({
      decision: "allow",
      risk: "medium",
      requiresApproval: false,
    });
  });

  it("requires approval for a by_exception action when the store asks for it", () => {
    const verdict = evaluateAiAction({
      context: contextWith(),
      toolName: "send_whatsapp_message",
      exceptionRequired: true,
    });
    expect(verdict.decision).toBe("require_approval");
    expect(verdict.requiresApproval).toBe(true);
    expect(verdict.reason).toMatch(/requires an explicit approval/i);
  });

  it("does not require approval when the store flag is absent", () => {
    const verdict = evaluateAiAction({
      context: contextWith(),
      toolName: "send_whatsapp_report",
    });
    expect(verdict.decision).toBe("allow");
  });

  it("allows admin order reads (admin + customer role policy)", () => {
    const admin = evaluateAiAction({
      context: contextWith(),
      toolName: "get_orders",
    });
    const customer = evaluateAiAction({
      context: contextWith({ role: "customer" }),
      toolName: "get_orders",
    });
    expect(admin.decision).toBe("allow");
    expect(customer.decision).toBe("allow");
  });
});
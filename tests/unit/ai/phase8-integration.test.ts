import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/ai/guardian-service", () => ({
  recordGuardianDecision: vi.fn(),
  updateGuardianExecution: vi.fn(),
  listGuardianDecisions: vi.fn(),
  countPendingGuardianDecisions: vi.fn(),
}));

vi.mock("@/services/ai/approval-service", () => ({
  createApprovalRequest: vi.fn(),
  decideApprovalRequest: vi.fn(),
}));

vi.mock("@/services/notifications/notification-service", () => ({
  notifyAdminsOfApprovalRequest: vi.fn(),
}));

import type { AgentContext } from "@/agents/context";
import {
  recordGuardianDecision as mockRecordGuardianDecision,
  updateGuardianExecution as mockUpdateGuardianExecution,
} from "@/services/ai/guardian-service";
import {
  createApprovalRequest as mockCreateApprovalRequest,
} from "@/services/ai/approval-service";
import { notifyAdminsOfApprovalRequest as mockNotifyAdmins } from "@/services/notifications/notification-service";
import { runGuardedTool } from "@/tools/shared/guarded";

/**
 * Guardian wrapper — end-to-end guarded tool behavior.
 *
 * Proves the fail-closed decision flow around the WhatsApp outbound action:
 * deny, allow (immediate execution), and require-approval all route through
 * the recorded Guardian decision, and only an allow actually runs the action.
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

function makeDeps(overrides: Partial<Parameters<typeof runGuardedTool>[0]> = {}) {
  return {
    context: contextWith(),
    agentName: "ai_manager",
    toolName: "send_whatsapp_message",
    actionType: "send_whatsapp_message",
    summary: "Send a WhatsApp message to the approved admin.",
    run: vi.fn().mockResolvedValue({ ok: true as const, data: { sent: true } }),
    approval: {
      buildExecution: () => ({ kind: "whatsapp_message", to: "923001234567" }),
      execute: vi.fn().mockResolvedValue({ ok: true as const, data: { sent: true } }),
    },
    ...overrides,
  };
}

describe("runGuardedTool — WhatsApp outbound", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(mockRecordGuardianDecision).mockReset();
    vi.mocked(mockUpdateGuardianExecution).mockReset();
    vi.mocked(mockCreateApprovalRequest).mockReset();
    vi.mocked(mockNotifyAdmins).mockReset();

    vi.mocked(mockRecordGuardianDecision).mockImplementation(
      async (input) => ({ id: "gd-1", ...input } as never),
    );
    vi.mocked(mockUpdateGuardianExecution).mockResolvedValue(undefined);
    vi.mocked(mockNotifyAdmins).mockResolvedValue(undefined);
    vi.mocked(mockCreateApprovalRequest).mockImplementation(async () => ({
      id: "apr-1",
      status: "pending",
      context_hash: "abc",
      requested_at: new Date().toISOString(),
    } as never));
  });

  it("denies the action for a customer who does not have permission", async () => {
    const deps = makeDeps({ context: contextWith({ role: "customer" }) });
    const result = await runGuardedTool(deps);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("forbidden");
    }
    expect(deps.run).not.toHaveBeenCalled();
    expect(mockRecordGuardianDecision).toHaveBeenCalledWith(
      expect.objectContaining({ decision: "deny", toolName: "send_whatsapp_message" }),
    );
  });

  it("denies unknown tools without calling the executor", async () => {
    const deps = makeDeps({
      toolName: "execute_any_sql",
      actionType: "execute_any_sql",
    });
    const result = await runGuardedTool(deps);
    expect(result.ok).toBe(false);
    expect(deps.run).not.toHaveBeenCalled();
    expect(mockRecordGuardianDecision).toHaveBeenCalledTimes(1);
  });

  it("allows a permitted action and stamps the decision as executed", async () => {
    const deps = makeDeps();
    const result = await runGuardedTool(deps as never);

    expect(result).toEqual({ ok: true, data: { sent: true } });
    expect(deps.run).toHaveBeenCalledTimes(1);
    expect(mockRecordGuardianDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        decision: "allow",
        risk: "medium",
        approvalRequired: false,
      }),
    );
    expect(mockUpdateGuardianExecution).toHaveBeenCalledWith(
      "gd-1",
      expect.objectContaining({ executionStatus: "executed" }),
    );
  });

  it("requires approval when the store demands it and never runs the action", async () => {
    const deps = makeDeps({ exceptionRequired: true });
    const result = await runGuardedTool(deps);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("forbidden");
      expect(result.message).toMatch(/approval/i);
    }
    expect(deps.run).not.toHaveBeenCalled();
    expect(mockCreateApprovalRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        guardianDecisionId: "gd-1",
        actionType: "send_whatsapp_message",
        risk: "medium",
        summary: "Send a WhatsApp message to the approved admin.",
      }),
    );
    expect(mockNotifyAdmins).toHaveBeenCalledTimes(1);
    expect(mockUpdateGuardianExecution).toHaveBeenCalledWith(
      "gd-1",
      expect.objectContaining({ executionStatus: "approved_pending" }),
    );
  });

  it("records the guardian decision before any execution decision", async () => {
    const deps = makeDeps();
    await runGuardedTool(deps as never);
    expect(mockRecordGuardianDecision).toHaveBeenCalledTimes(1);
    const call = vi.mocked(mockRecordGuardianDecision).mock.calls[0][0];
    expect(call).toMatchObject({
      agentName: "ai_manager",
      toolName: "send_whatsapp_message",
      actorRole: "admin",
      userId: "u-admin",
    });
  });
});
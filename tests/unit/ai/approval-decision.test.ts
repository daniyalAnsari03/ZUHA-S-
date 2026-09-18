import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

import { createClient as mockSupabaseCreateClient } from "@supabase/supabase-js";
import {
  decideApprovalRequest,
  type ApprovalRequestRow,
} from "@/services/ai/approval-service";

/**
 * decideApprovalRequest — approval integrity + honest error reporting.
 *
 * The admin "Approve & send" click must never hide the real reason a decision
 * failed behind the generic "Failed to update the approval request." A failing
 * executor (e.g. WhatsApp provider rejecting the recipient) must surface its
 * actual error and must NOT mark the request approved.
 */

function approvalRequest(
  overrides: Partial<ApprovalRequestRow> = {},
): ApprovalRequestRow {
  return {
    id: "apr-1",
    guardian_decision_id: "gd-1",
    user_id: "u-1",
    agent_name: "manager",
    action_type: "whatsapp.message.send",
    risk: "medium",
    target_type: "whatsapp_message",
    target_id: null,
    summary: "Send a WhatsApp message to Owner",
    execution: { kind: "whatsapp_message", content: "Test message" },
    context_hash: "abc123",
    status: "pending",
    requested_at: new Date().toISOString(),
    decided_by: null,
    decided_at: null,
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    ...overrides,
  };
}

function fakeClient(request: ApprovalRequestRow | null) {
  const updates: Record<string, unknown>[] = [];
  const chain = {
    select: () => chain,
    order: () => chain,
    limit: () => chain,
    eq: () => chain,
    insert: () => chain,
    update: (payload: Record<string, unknown>) => {
      updates.push(payload);
      return chain;
    },
    maybeSingle: () => Promise.resolve({ data: request, error: null }),
    single: () => Promise.resolve({ data: request, error: null }),
  };
  return {
    client: { from: () => chain } as never,
    updates,
    updatesThis: updates as ReadonlyArray<Record<string, unknown>>,
  };
}

describe("decideApprovalRequest", () => {
  beforeEach(() => {
    vi.mocked(mockSupabaseCreateClient).mockReset();
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  });

  it("approves only after the executor succeeds using the frozen payload", async () => {
    const fake = fakeClient(approvalRequest());
    vi.mocked(mockSupabaseCreateClient).mockReturnValue(fake.client);

    const executor = vi.fn().mockResolvedValue({ ok: true, message: "done" });
    const result = await decideApprovalRequest({
      approvalId: "apr-1",
      decisionBy: "admin-1",
      approve: true,
      executor,
    });

    expect(result).toEqual({ ok: true, message: "Approved." });
    expect(executor).toHaveBeenCalledTimes(1);
    expect(executor).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "whatsapp_message", content: "Test message" }),
    );
    expect(fake.updates).toHaveLength(1);
    expect(fake.updates[0]).toMatchObject({
      status: "approved",
      decided_by: "admin-1",
    });
  });

  it("surfaces the executor error and does NOT mark the request approved", async () => {
    const fake = fakeClient(approvalRequest());
    vi.mocked(mockSupabaseCreateClient).mockReturnValue(fake.client);

    const executor = vi
      .fn()
      .mockResolvedValue({ ok: false, error: "provider failure 131030" });
    const result = await decideApprovalRequest({
      approvalId: "apr-1",
      decisionBy: "admin-1",
      approve: true,
      executor,
    });

    expect(result).toEqual({ ok: false, error: "provider failure 131030" });
    expect(executor).toHaveBeenCalledTimes(1);
    expect(fake.updates).toHaveLength(0);
  });

  it("rejects without invoking the executor", async () => {
    const fake = fakeClient(approvalRequest());
    vi.mocked(mockSupabaseCreateClient).mockReturnValue(fake.client);

    const executor = vi.fn();
    const result = await decideApprovalRequest({
      approvalId: "apr-1",
      decisionBy: "admin-1",
      approve: false,
      executor,
    });

    expect(result).toEqual({ ok: true, message: "Rejected." });
    expect(executor).not.toHaveBeenCalled();
    expect(fake.updates).toHaveLength(1);
    expect(fake.updates[0]).toMatchObject({
      status: "rejected",
      decided_by: "admin-1",
    });
  });

  it("refuses to decide a request that is already decided", async () => {
    const fake = fakeClient(approvalRequest({ status: "approved" }));
    vi.mocked(mockSupabaseCreateClient).mockReturnValue(fake.client);

    const executor = vi.fn();
    const result = await decideApprovalRequest({
      approvalId: "apr-1",
      decisionBy: "admin-1",
      approve: true,
      executor,
    });

    expect(result).toEqual({
      ok: false,
      error: "Approval is already approved.",
    });
    expect(executor).not.toHaveBeenCalled();
    expect(fake.updates).toHaveLength(0);
  });

  it("reports an unknown approval id", async () => {
    const fake = fakeClient(null);
    vi.mocked(mockSupabaseCreateClient).mockReturnValue(fake.client);

    const result = await decideApprovalRequest({
      approvalId: "missing",
      decisionBy: "admin-1",
      approve: true,
    });

    expect(result).toEqual({ ok: false, error: "Approval request not found." });
  });
});
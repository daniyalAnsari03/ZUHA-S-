import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";
import { ServiceError } from "@/services/base";
import type { RiskLevel } from "@/lib/security/guardians";

export type ApprovalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "expired"
  | "cancelled";

export type ApprovalRequestRow = {
  id: string;
  guardian_decision_id: string | null;
  user_id: string | null;
  agent_name: string;
  action_type: string;
  risk: RiskLevel;
  target_type: string | null;
  target_id: string | null;
  summary: string;
  execution: Record<string, unknown>;
  context_hash: string;
  status: ApprovalStatus;
  requested_at: string;
  decided_by: string | null;
  decided_at: string | null;
  expires_at: string;
};

export type CreateApprovalRequestInput = {
  guardianDecisionId: string | null;
  userId: string | null;
  agentName: string;
  actionType: string;
  risk: RiskLevel;
  targetType?: string | null;
  targetId?: string | null;
  summary: string;
  /** Safe, non-secret execution payload captured at request time. */
  execution?: Record<string, unknown>;
  contextHash: string;
  expiresAt?: string;
};

/**
 * Create an approval request for a high-risk AI action. `execution` captures
 * everything the executor needs to re-run the action AFTER a human approves,
 * so the approval flow re-executes the exact intended operation rather than
 * trusting a future client/agent payload. Never store credentials in it.
 */
export async function createApprovalRequest(
  input: CreateApprovalRequestInput,
): Promise<ApprovalRequestRow | null> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("approval_requests")
      .insert({
        guardian_decision_id: input.guardianDecisionId,
        user_id: input.userId,
        agent_name: input.agentName,
        action_type: input.actionType,
        risk: input.risk,
        target_type: input.targetType ?? null,
        target_id: input.targetId ?? null,
        summary: input.summary,
        execution:
          input.execution && Object.keys(input.execution).length > 0
            ? (input.execution as Json)
            : {},
        context_hash: input.contextHash,
        status: "pending",
        expires_at: input.expiresAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })
      .select("*")
      .single();

    if (error) {
      console.error("[approval] request create failed:", error.message);
      return null;
    }

    return (data ?? null) as ApprovalRequestRow | null;
  } catch (error) {
    console.error("[approval] request create failed:", error);
    return null;
  }
}

/** Load a single approval request by id (for decisions + execution). */
export async function getApprovalRequest(
  approvalId: string,
): Promise<ApprovalRequestRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("approval_requests")
    .select("*")
    .eq("id", approvalId)
    .maybeSingle();

  if (error) {
    throw new ServiceError(
      "APPROVAL_READ_FAILED",
      "Failed to load the approval request.",
      error,
    );
  }

  return (data ?? null) as ApprovalRequestRow | null;
}

/** Admin list of approval requests (newest first, optional status filter). */
export async function listApprovalRequests(options?: {
  limit?: number;
  status?: ApprovalStatus;
}): Promise<ApprovalRequestRow[]> {
  const supabase = createAdminClient();
  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 200);

  let query = supabase
    .from("approval_requests")
    .select("*")
    .order("requested_at", { ascending: false })
    .limit(limit);

  if (options?.status) {
    query = query.eq("status", options.status);
  }

  const { data, error } = await query;

  if (error) {
    throw new ServiceError(
      "APPROVAL_READ_FAILED",
      "Failed to load approval requests.",
      error,
    );
  }

  return (data ?? []) as unknown as ApprovalRequestRow[];
}

/**
 * Verify that an approval request may still be executed:
 *   - must exist
 *   - must be approved
 *   - must not have expired (wall-clock check against expires_at)
 *   - context_hash must match what was captured at request time
 *
 * Call this in the approval-gated executor before RUNNING the approved action.
 * It guarantees the action executed matches the action approved.
 */
export function validateApprovalForExecution(
  request: ApprovalRequestRow | null,
  contextHash: string,
): { ok: true } | { ok: false; reason: string } {
  if (!request) {
    return { ok: false, reason: "Approval request not found." };
  }
  if (request.status !== "approved") {
    return {
      ok: false,
      reason: `Approval is not approved (current status: ${request.status}).`,
    };
  }
  const now = Date.now();
  const expiresAt = new Date(request.expires_at).getTime();
  if (!Number.isFinite(expiresAt) || now > expiresAt) {
    return { ok: false, reason: "Approval has expired. Please request a fresh approval." };
  }
  if (request.context_hash !== contextHash) {
    return {
      ok: false,
      reason:
        "The action details no longer match what was approved. Please request a fresh approval.",
    };
  }
  return { ok: true };
}

/**
 * Approve (or reject) an approval request. When an `executor` callback is
 * provided and the request is being APPROVED, the executor is invoked with the
 * stored execution payload; only after it succeeds is the request marked
 * approved. This keeps "approved" meaning "this action ran" for gated tools
 * where the actual send happens at decision time.
 */
export async function decideApprovalRequest(input: {
  approvalId: string;
  decisionBy: string;
  approve: boolean;
  executor?: (execution: Record<string, unknown>) => Promise<{ ok: boolean; error?: string }>;
}): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const supabase = createAdminClient();
  const request = await getApprovalRequest(input.approvalId);
  if (!request) {
    return { ok: false, error: "Approval request not found." };
  }
  if (request.status !== "pending") {
    return { ok: false, error: `Approval is already ${request.status}.` };
  }

  try {
    if (input.approve) {
      if (input.executor) {
        const executionResult = await input.executor(request.execution ?? {});
        if (!executionResult.ok) {
          throw new ServiceError(
            "APPROVAL_EXECUTION_FAILED",
            executionResult.error ?? "The approved action could not be executed.",
          );
        }
      }

      const { error } = await supabase
        .from("approval_requests")
        .update({
          status: "approved",
          decided_by: input.decisionBy,
          decided_at: new Date().toISOString(),
        })
        .eq("id", input.approvalId);
      if (error) {
        throw error;
      }
      return { ok: true, message: "Approved." };
    }

    const { error } = await supabase
      .from("approval_requests")
      .update({
        status: "rejected",
        decided_by: input.decisionBy,
        decided_at: new Date().toISOString(),
      })
      .eq("id", input.approvalId);
    if (error) {
      throw error;
    }
    return { ok: true, message: "Rejected." };
  } catch {
    return {
      ok: false,
      error: "Failed to update the approval request.",
    };
  }
}
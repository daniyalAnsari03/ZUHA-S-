import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";
import { ServiceError } from "@/services/base";
import type { RiskLevel } from "@/lib/security/guardians";

export type GuardianDecisionStatus =
  | "allow"
  | "deny"
  | "require_approval";

export type GuardianExecutionStatus =
  | "pending"
  | "approved_pending"
  | "executed"
  | "blocked"
  | "failed"
  | "skipped";

export type GuardianDecisionInput = {
  userId: string | null;
  actorRole: "admin" | "customer" | "guest";
  agentName: string;
  toolName: string;
  actionType: string;
  risk: RiskLevel;
  decision: GuardianDecisionStatus;
  reason?: string;
  targetType?: string;
  targetId?: string;
  /** Non-sensitive structured argument summary. Never include secrets. */
  args?: Record<string, unknown>;
  approvalRequired?: boolean;
  approvalId?: string | null;
  executionStatus?: GuardianExecutionStatus;
};

export type GuardianDecisionRow = {
  id: string;
  user_id: string | null;
  actor_role: "admin" | "customer" | "guest";
  agent_name: string;
  tool_name: string | null;
  action_type: string;
  risk: RiskLevel;
  decision: GuardianDecisionStatus;
  reason: string | null;
  target_type: string | null;
  target_id: string | null;
  args: Record<string, unknown>;
  approval_required: boolean;
  approval_id: string | null;
  execution_status: GuardianExecutionStatus;
  executed_at: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Persist a Guardian decision for an AI action. Uses the service-role client
 * (server-only) so decisions are recorded regardless of the caller's channel;
 * RLS confines reads to admins. Best-effort-safe: a failed decision insert
 * must never break the action flow, so errors are surfaced to the caller only,
 * never thrown.
 */
export async function recordGuardianDecision(
  input: GuardianDecisionInput,
): Promise<GuardianDecisionRow | null> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("guardian_decisions")
      .insert({
        user_id: input.userId,
        actor_role: input.actorRole,
        agent_name: input.agentName,
        tool_name: input.toolName,
        action_type: input.actionType,
        risk: input.risk,
        decision: input.decision,
        reason: input.reason ?? null,
        target_type: input.targetType ?? null,
        target_id: input.targetId ?? null,
        args:
          input.args && Object.keys(input.args).length > 0
            ? (input.args as Json)
            : {},
        approval_required: input.approvalRequired ?? false,
        approval_id: input.approvalId ?? null,
        execution_status: input.executionStatus ?? "pending",
      })
      .select("*")
      .single();

    if (error) {
      console.error("[guardian] decision insert failed:", error.message);
      return null;
    }

    return (data ?? null) as GuardianDecisionRow | null;
  } catch (error) {
    console.error("[guardian] decision persistence failed:", error);
    return null;
  }
}

/** Update the execution lifecycle of a recorded decision. */
export async function updateGuardianExecution(
  decisionId: string,
  input: {
    executionStatus?: GuardianExecutionStatus;
    executedAt?: string | null;
  },
): Promise<void> {
  try {
    const supabase = createAdminClient();
    await supabase
      .from("guardian_decisions")
      .update({
        execution_status: input.executionStatus,
        executed_at: input.executedAt ?? undefined,
        updated_at: new Date().toISOString(),
      })
      .eq("id", decisionId);
  } catch (error) {
    console.error("[guardian] execution update failed:", error);
  }
}

/** Admin view of Guardian decisions (newest first). */
export async function listGuardianDecisions(options?: {
  limit?: number;
  decision?: GuardianDecisionStatus;
}): Promise<GuardianDecisionRow[]> {
  const supabase = createAdminClient();
  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 200);

  let query = supabase
    .from("guardian_decisions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (options?.decision) {
    query = query.eq("decision", options.decision);
  }

  const { data, error } = await query;

  if (error) {
    throw new ServiceError(
      "GUARDIAN_READ_FAILED",
      "Failed to load Guardian decisions.",
      error,
    );
  }

  return (data ?? []) as unknown as GuardianDecisionRow[];
}

/** Count pending (unresolved) guardian decisions, for admin visibility. */
export async function countPendingGuardianDecisions(): Promise<number> {
  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from("guardian_decisions")
    .select("id", { count: "exact", head: true })
    .eq("execution_status", "approved_pending");

  if (error) {
    return 0;
  }

  return count ?? 0;
}
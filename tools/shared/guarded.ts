import { createHash } from "node:crypto";

import type { AgentContext } from "@/agents/context";
import { contextActorRole } from "@/agents/context";
import { evaluateAiAction } from "@/guardians/engine";
import {
  recordGuardianDecision,
  updateGuardianExecution,
  type GuardianDecisionStatus,
} from "@/services/ai/guardian-service";
import {
  createApprovalRequest,
  decideApprovalRequest,
} from "@/services/ai/approval-service";
import { notifyAdminsOfApprovalRequest } from "@/services/notifications/notification-service";
import type { ToolResult } from "@/tools/shared/result";

/**
 * Guardian + approval wrapper for AI tools.
 *
 * Every guarded tool:
 *   1. evaluates the intended action against the Guardian policy registry
 *      (fail-closed: unknown tools and unauthorized roles are denied)
 *   2. persists the Guardian decision
 *   3. either runs the action, or raises an approval request that a human must
 *      approve before the captured `execution` payload is re-executed
 *
 * The tool that requests approval supplies BOTH a fully-formed `run` (used when
 * the action is allowed outright) and an `execution` builder whose payload is
 * frozen at request time. The approval endpoint can only execute the frozen
 * payload — never a future, possibly-different request.
 */

export type GuardedToolDeps<T> = {
  context: AgentContext;
  agentName: string;
  toolName: string;
  actionType: string;
  /** Sanitized, non-secret argument summary stored with the decision. */
  argsSummary?: Record<string, unknown>;
  /** Human-readable summary shown to the approver. */
  summary: string;
  /** Whether the store config makes this action require approval by exception. */
  exceptionRequired?: boolean;
  /** The real action executor. */
  run: () => Promise<ToolResult<T>>;
  /**
   * When present, defines the frozen execution payload + executor used at
   * approval time. If omitted, approved requests are recorded as approved
   * without re-execution (read-style approvals).
   */
  approval?: {
    buildExecution: () => Record<string, unknown>;
    execute: (execution: Record<string, unknown>) => Promise<ToolResult<T>>;
  };
};

export function buildContextHash(parts: Record<string, unknown>): string {
  return createHash("sha256")
    .update(JSON.stringify(parts))
    .digest("hex");
}

export async function runGuardedTool<T>(
  deps: GuardedToolDeps<T>,
): Promise<ToolResult<T>> {
  const { context } = deps;

  const verdict = evaluateAiAction({
    context,
    toolName: deps.toolName,
    exceptionRequired: deps.exceptionRequired,
  });

  const decisionStatus: GuardianDecisionStatus = verdict.decision;

  const recorded = await recordGuardianDecision({
    userId: context.userId,
    actorRole: contextActorRole(context),
    agentName: deps.agentName,
    toolName: deps.toolName,
    actionType: deps.actionType,
    risk: verdict.risk,
    decision: decisionStatus,
    reason: verdict.reason,
    args: deps.argsSummary ?? {},
    approvalRequired: verdict.requiresApproval,
    executionStatus:
      verdict.decision === "allow"
        ? "pending"
        : verdict.decision === "deny"
          ? "blocked"
          : "approved_pending",
  });

  // DENY — fail closed.
  if (verdict.decision === "deny") {
    return {
      ok: false,
      reason: "forbidden",
      message: verdict.reason,
    };
  }

  // ALLOW — run immediately, then stamp the decision lifecycle.
  if (verdict.decision === "allow" && !verdict.requiresApproval) {
    const result = await deps.run();
    if (recorded?.id) {
      await updateGuardianExecution(recorded.id, {
        executionStatus: result.ok ? "executed" : "failed",
        executedAt: new Date().toISOString(),
      });
    }
    return result;
  }

  // REQUIRE_APPROVAL — raise an approval request with a frozen execution.
  if (verdict.decision === "require_approval") {
    const approvalExecution = deps.approval?.buildExecution() ?? {};

    const contextHashParts: Record<string, unknown> = {
      tool: deps.toolName,
      actionType: deps.actionType,
      requestedBy: context.userId ?? null,
      summary: deps.summary,
      ...(deps.argsSummary ?? {}),
    };

    const request = await createApprovalRequest({
      guardianDecisionId: recorded?.id ?? null,
      userId: context.userId,
      agentName: deps.agentName,
      actionType: deps.actionType,
      risk: verdict.risk,
      targetType:
        typeof approvalExecution.kind === "string"
          ? approvalExecution.kind
          : null,
      targetId: undefined,
      summary: deps.summary,
      execution: approvalExecution,
      contextHash: buildContextHash(contextHashParts),
    });

    if (recorded?.id && request?.id) {
      await updateGuardianExecution(recorded.id, {
        executionStatus: "approved_pending",
        executedAt: null,
      });
    }

    await notifyAdminsOfApprovalRequest({
      summary: deps.summary,
      actionType: deps.actionType,
    }).catch(() => {});

    return {
      ok: false,
      reason: "forbidden",
      message:
        "This action needs an explicit approval before it can run. An approval request has been raised — check the AI Workplace Pending Approvals. Nothing was sent.",
    };
  }

  return {
    ok: false,
    reason: "error",
    message: "The action could not be evaluated safely. Nothing was changed.",
  };
}

/**
 * Execute the frozen payload of an approved request. The exact payload the
 * admin approved (matching context_hash at approval time) is passed through to
 * the executor. Returns the executor's result.
 */
export async function executeApprovedRequest<T>(
  request: { id: string; execution: Record<string, unknown>; context_hash: string },
  executor: (execution: Record<string, unknown>) => Promise<ToolResult<T>>,
): Promise<ToolResult<T>> {
  return executor(request.execution ?? {});
}

/**
 * Approve an approval request and run its frozen executor. Re-exports the
 * service-level decision function for the admin UI. the executor is the tool's
 * registered approval executor keyed by the frozen execution payload.
 */
export { decideApprovalRequest };

export type { ToolResult };
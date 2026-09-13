import { contextActorRole, type AgentContext } from "@/agents/context";
import {
  writeAiAuditLog,
  type AuditRisk,
} from "@/services/ai/audit-service";
import type { ToolResult, ToolFailureReason } from "@/tools/shared/result";

export type AuditToolOptions = {
  context: AgentContext;
  agentName: string;
  toolName: string;
  actionType: string;
  risk: AuditRisk;
  entityType?: string;
  entityId?: string;
  /** Short, non-sensitive summary describing what was attempted. */
  summary?: string;
};

/**
 * Records a run-turn outcome into ai_audit_logs. Append-only, best-effort and
 * sanitized — never stores messages, keys, secrets or personal data.
 */
export async function auditToolResult(
  options: AuditToolOptions,
  result: { ok: boolean; reason?: ToolFailureReason },
): Promise<void> {
  await writeAiAuditLog({
    userId: options.context.userId,
    actorRole: contextActorRole(options.context),
    agentName: options.agentName,
    toolName: options.toolName,
    actionType: options.actionType,
    risk: options.risk,
    status: result.ok
      ? "granted"
      : result.reason === "forbidden"
        ? "denied"
        : result.reason === "not_found"
          ? "denied"
          : "error",
    entityType: options.entityType,
    entityId: options.entityId,
    detail: {
      requestId: options.context.requestId,
      summary: options.summary,
    },
  });
}

/**
 * Runs a tool execution, records the audit line for the turn, and returns the
 * structured result unchanged. Errors raised by the executor are mapped to a
 * generic failure (audit still records them) so exceptions never leak.
 */
export async function withToolAudit<T>(
  options: AuditToolOptions,
  run: () => Promise<ToolResult<T>>,
): Promise<ToolResult<T>> {
  try {
    const result = await run();
    await auditToolResult(options, result);
    return result;
  } catch (error) {
    console.error("[ai-tool] execution failed:", error);
    await auditToolResult(options, { ok: false, reason: "error" });
    return {
      ok: false,
      reason: "error",
      message:
        "An unexpected error occurred while completing this action. No changes were made.",
    };
  }
}
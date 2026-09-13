import { createAdminClient } from "@/lib/supabase/admin";

import type { Json } from "@/lib/supabase/types";
import { ServiceError } from "@/services/base";

export type AuditActorRole = "admin" | "customer" | "guest";
export type AuditRisk = "low" | "medium" | "high";
export type AuditStatus = "granted" | "denied" | "error";

export type AiAuditLogInput = {
  userId: string | null;
  actorRole: AuditActorRole;
  agentName: string;
  toolName?: string;
  actionType: string;
  risk: AuditRisk;
  status: AuditStatus;
  entityType?: string;
  entityId?: string;
  /** Non-sensitive structured detail. Never include secrets, keys or raw messages. */
  detail?: Record<string, unknown>;
};

type AuditRow = {
  id: string;
  user_id: string | null;
  actor_role: AuditActorRole;
  agent_name: string;
  tool_name: string | null;
  action_type: string;
  risk: AuditRisk;
  status: AuditStatus;
  entity_type: string | null;
  entity_id: string | null;
  detail: Record<string, unknown>;
  created_at: string;
};

/**
 * Best-effort audit writer for AI actions.
 *
 * The service-role client is used because audit rows reference callers from
 * every channel (admin, customer and guest) and must never be blocked by RLS.
 * It is server-only and writes sanitized, non-sensitive metadata only.
 *
 * Failures must never break a chat/turn, so errors are swallowed after logging
 * to the server console.
 */
export async function writeAiAuditLog(
  input: AiAuditLogInput,
): Promise<void> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("ai_audit_logs").insert({
      user_id: input.userId,
      actor_role: input.actorRole,
      agent_name: input.agentName,
      tool_name: input.toolName ?? null,
      action_type: input.actionType,
      risk: input.risk,
      status: input.status,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      detail:
        "detail" in input && input.detail && Object.keys(input.detail).length > 0
          ? (input.detail as Json)
          : {},
    });

    if (error) {
      console.error("[ai-audit] insert failed:", error.message);
    }
  } catch (error) {
    console.error("[ai-audit] audit write failed:", error);
  }
}

/**
 * Admin view of AI activity (newest first). Only meaningful for admin callers;
 * callers are expected to verify authorization before invoking.
 */
export async function listAiAuditLogs(
  options?: { limit?: number; agentName?: string; status?: AuditStatus },
): Promise<AuditRow[]> {
  const supabase = createAdminClient();
  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 200);

  let query = supabase
    .from("ai_audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (options?.agentName) {
    query = query.eq("agent_name", options.agentName);
  }
  if (options?.status) {
    query = query.eq("status", options.status);
  }

  const { data, error } = await query;

  if (error) {
    throw new ServiceError(
      "AI_AUDIT_READ_FAILED",
      "Failed to load AI audit logs.",
      error,
    );
  }

  return (data ?? []) as unknown as AuditRow[];
}
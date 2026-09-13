import type { AuditActorRole } from "@/services/ai/audit-service";
import type { FocusEntity } from "@/services/ai/focus-service";

/**
 * Shared execution context threaded through every AI run.
 *
 * Tools read `runContext.context` to authorize each action. The context is
 * intentionally minimal: identity + role + channel. It never carries secrets
 * or credentials, and tools must fail closed when authorization is missing.
 */
export type AgentContext = {
  /** The authenticated auth user id, or null for guests. */
  userId: string | null;
  /** The resolved application role, or null for guests. */
  role: "admin" | "customer" | null;
  /** Where the conversation lives: the admin workplace or the storefront. */
  channel: "admin" | "salesman";
  /** Unique id for this run turn (used for tracing + audit correlation). */
  requestId: string;
  /** The persisted conversation id for this thread, if one exists. */
  conversationId?: string;
  /**
   * The conversation's current focus entity (last product/order/customer
   * named or acted on), resolved before the run from the tool audit trail so
   * ambiguous follow-ups resolve against explicit tracked state.
   */
  focusEntity?: FocusEntity | null;
  /**
   * Stamped by the tool role guardrail before a guarded tool executes.
   * Tools use this for audit attribution when per-tool execution context
   * does not expose the invoking agent directly.
   */
  agentName?: string;
};

export function contextActorRole(context: AgentContext): AuditActorRole {
  return context.role === "admin"
    ? "admin"
    : context.role === "customer"
      ? "customer"
      : "guest";
}
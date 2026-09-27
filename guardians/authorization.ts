import {
  defineToolInputGuardrail,
  type ToolInputGuardrailDefinition,
} from "@openai/agents";

import type { AgentContext } from "@/agents/context";

export const ADMIN_ROLE = "admin" as const;
export const CUSTOMER_ROLE = "customer" as const;

export type AgentRole = typeof ADMIN_ROLE | typeof CUSTOMER_ROLE;

export type RoleCheck =
  { ok: true; role: AgentRole } | { ok: false; message: string };

/**
 * Fail-closed role check. Tools never proceed without a verified application
 * role in context; guests and mismatched roles are rejected message-first.
 */
export function checkRole(
  context: AgentContext,
  allowed: AgentRole[],
): RoleCheck {
  if (context.role && allowed.includes(context.role)) {
    return { ok: true, role: context.role };
  }

  const expected = allowed.includes(ADMIN_ROLE)
    ? "an admin"
    : "a signed-in customer";
  return {
    ok: false,
    message: `This action requires ${expected}. You don't have permission for it.`,
  };
}

export function isAdmin(context: AgentContext): boolean {
  return context.role === ADMIN_ROLE;
}

/**
 * SDK-level tool input guardrail. Returning with `rejectContent` prevents the
 * tool from even executing and surfaces a clean message to the model, so an
 * employee agent can never run a privileged tool for an unauthorized caller.
 */
export function toolRoleGuardrail(
  toolName: string,
  allowed: AgentRole[],
): ToolInputGuardrailDefinition<AgentContext> {
  return defineToolInputGuardrail<AgentContext>({
    name: `require_role_${toolName}`,
    run: async ({ context, agent }) => {
      const ctx = context.context;
      // Stamp the invoking agent name so audited tools can attribute the action.
      // This assignment writes into the shared mutable AgentContext, making the
      // value available to the execute callback that runs immediately after.
      ctx.agentName = agent.name;

      const check = checkRole(ctx, allowed);
      if (!check.ok) {
        return {
          behavior: { type: "rejectContent", message: check.message },
          outputInfo: { tool: toolName, allowed },
        };
      }
      return { behavior: { type: "allow" } };
    },
  });
}

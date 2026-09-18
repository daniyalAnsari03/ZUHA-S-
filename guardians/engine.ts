import type { RiskLevel } from "@/lib/security/guardians";
import type { AgentContext } from "@/agents/context";

/**
 * Guardian engine — the pure security decision core for AI actions.
 *
 * This module classifies an intended AI action against an application-defined
 * policy registry and produces a fail-closed decision:
 *
 *   - An action with NO known policy is DENIED.
 *   - An action attempted by a role WITHOUT permission is DENIED.
 *   - An action whose policy requires approval is marked REQUIRE_APPROVAL.
 *   - Only explicitly allowed + authorized actions evaluate to ALLOW.
 *
 * The engine is pure (no I/O, no database) so it is trivially testable and can
 * never leak secrets. Persistence of decisions happens in the service layer.
 *
 * Policy model keyed by tool name; tools that are not registered here can never
 * execute through the guarded wrapper (fail closed).
 */

export type ApprovalRequirement = "never" | "by_exception" | "always";

export interface GuardianToolPolicy {
  /** Risk classification of this action type. */
  risk: RiskLevel;
  /** Roles permitted to invoke the action. */
  allowedRoles: ReadonlyArray<"admin" | "customer">;
  /**
   * Whether execution requires an explicit human approval:
   *   - "never"        — no approval ever required.
   *   - "by_exception" — required only when a context flag requests it
   *                      (e.g. send operations when the store requires
   *                      approvals in settings).
   *   - "always"       — always required (high-risk actions).
   */
  approval: ApprovalRequirement;
}

/**
 * Action policies. This registry is the single source of truth the Guardian
 * uses to classify AI actions. Anything not listed here is DENIED.
 */
export const ACTION_POLICIES: Readonly<Record<string, GuardianToolPolicy>> = {
  /* ------------------------------------------------------------------ */
  /* Catalog + analytics reads (low risk, open to admins)                */
  /* ------------------------------------------------------------------ */
  get_sales_overview: {
    risk: "low",
    allowedRoles: ["admin"],
    approval: "never",
  },
  get_low_stock: {
    risk: "low",
    allowedRoles: ["admin"],
    approval: "never",
  },
  get_orders: {
    risk: "low",
    allowedRoles: ["admin", "customer"],
    approval: "never",
  },

  /* ------------------------------------------------------------------ */
  /* WhatsApp outbound (medium/high risk, approval configurable)         */
  /* ------------------------------------------------------------------ */
  send_whatsapp_message: {
    risk: "medium",
    allowedRoles: ["admin"],
    approval: "by_exception",
  },
  send_whatsapp_report: {
    risk: "medium",
    allowedRoles: ["admin"],
    approval: "by_exception",
  },
};

export type GuardianVerdict =
  | {
      decision: "allow";
      risk: RiskLevel;
      requiresApproval: false;
      reason: string;
    }
  | {
      decision: "deny";
      risk: RiskLevel;
      requiresApproval: false;
      reason: string;
    }
  | {
      decision: "require_approval";
      risk: RiskLevel;
      requiresApproval: true;
      reason: string;
    };

export type GuardianEvalInput = {
  context: AgentContext;
  toolName: string;
  /** Whether the store is configured to require approval for this class. */
  exceptionRequired?: boolean;
};

const RISK_ORDER: Readonly<Record<RiskLevel, number>> = {
  low: 0,
  medium: 1,
  high: 2,
};

/**
 * Evaluate an intended AI action against the policy registry. Fail-closed:
 * any policy resolution error falls through to a DENY with a clear reason.
 */
export function evaluateAiAction(input: GuardianEvalInput): GuardianVerdict {
  const { context, toolName, exceptionRequired } = input;

  const policy = ACTION_POLICIES[toolName];
  if (!policy) {
    return {
      decision: "deny",
      risk: "high",
      requiresApproval: false,
      reason: `The tool "${toolName}" is not registered with the Guardian. Action denied for safety.`,
    };
  }

  const role = context.role;
  if (!role || !policy.allowedRoles.includes(role)) {
    return {
      decision: "deny",
      risk: policy.risk,
      requiresApproval: false,
      reason: `Action "${toolName}" is not permitted for ${
        role ?? "guest"
      } callers.`,
    };
  }

  if (policy.approval === "always") {
    return {
      decision: "require_approval",
      risk: policy.risk,
      requiresApproval: true,
      reason: `Action "${toolName}" always requires an explicit approval before execution.`,
    };
  }

  if (
    policy.approval === "by_exception" &&
    (exceptionRequired ?? false)
  ) {
    return {
      decision: "require_approval",
      risk: policy.risk,
      requiresApproval: true,
      reason: `Action "${toolName}" requires an explicit approval because the store is configured to approve ${RISK_ORDER[policy.risk] >= 1 ? `${policy.risk}-risk` : ""} outbound actions.`,
    };
  }

  return {
    decision: "allow",
    risk: policy.risk,
    requiresApproval: false,
    reason: `Action "${toolName}" is permitted for ${
      role
    } callers at ${policy.risk} risk.`,
  };
}
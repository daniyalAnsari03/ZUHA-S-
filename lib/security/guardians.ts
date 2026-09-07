import type { Role } from "@/lib/auth/roles";

/**
 * Guardian foundation interfaces.
 *
 * Phase 1 establishes the shape of the Guardian security layer so later
 * phases can implement concrete checks without architectural rewrites.
 * No fake behavior is provided — concrete Guardian implementations belong
 * to dedicated phases (see AGENTS.md §9).
 */

export type RiskLevel = "low" | "medium" | "high";

export interface GuardianContext {
  /** The authenticated caller, if any. */
  actor?: {
    id: string;
    role: Role;
  } | null;
  /** Human-readable description of the intended action. */
  action: string;
  /** Requested tool/operation name, when applicable. */
  operation?: string;
}

export interface GuardianDecision {
  allowed: boolean;
  risk: RiskLevel;
  /** Machine-readable reason when blocked. */
  reason?: string;
  /** Whether explicit approval is required before execution. */
  requiresApproval: boolean;
}

export interface Guardian {
  readonly name: string;
  evaluate(context: GuardianContext): Promise<GuardianDecision>;
}

/**
 * Evaluate a single Guardian and return its decision.
 */
export async function evaluateGuardian(
  guardian: Guardian,
  context: GuardianContext,
): Promise<GuardianDecision> {
  return guardian.evaluate(context);
}

/**
 * Evaluate a chain of Guardians. All must allow for the overall decision to
 * be allowed. The highest risk and most restrictive approval flag win.
 */
export async function evaluateGuardians(
  guardians: readonly Guardian[],
  context: GuardianContext,
): Promise<GuardianDecision> {
  const decisions = await Promise.all(
    guardians.map((g) => evaluateGuardian(g, context)),
  );

  const blocked = decisions.find((d) => !d.allowed);
  if (blocked) {
    return blocked;
  }

  const riskOrder: Record<RiskLevel, number> = {
    low: 0,
    medium: 1,
    high: 2,
  };

  let risk: RiskLevel = "low";
  for (const d of decisions) {
    if (riskOrder[d.risk] > riskOrder[risk]) {
      risk = d.risk;
    }
  }

  return {
    allowed: true,
    risk,
    requiresApproval: decisions.some((d) => d.requiresApproval),
  };
}

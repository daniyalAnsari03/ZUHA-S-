import type { GuardianDecision } from "@/lib/security/guardians";

/**
 * Email reporting Guardian — risk classification for report-email sends.
 *
 * Sending an email is an outbound side effect, so it is always at least
 * medium risk. It is NEVER a low-risk background operation for interactive
 * channels because it can reach a real mailbox:
 *
 *   cron  → automated engine at a fixed cadence → allowed, low risk.
 *   admin → explicit owner action in the Admin Panel → allowed, medium risk.
 *   ai    → owner-directed chat command ("report bhejo") → allowed,
 *            medium risk (audited, no hard gate — the owner is authorized).
 *   other → unknown/unverified channel → BLOCKED, high risk.
 */
export function classifyEmailReportSend(
  source: "cron" | "admin" | "ai",
): GuardianDecision {
  switch (source) {
    case "cron":
      return { allowed: true, risk: "low", requiresApproval: false };
    case "admin":
    case "ai":
      return { allowed: true, risk: "medium", requiresApproval: false };
    default:
      return {
        allowed: false,
        risk: "high",
        requiresApproval: true,
        reason: "Unverified report-send source. The send was blocked.",
      };
  }
}

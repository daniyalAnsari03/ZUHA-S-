"use server";

import { revalidatePath } from "next/cache";

import { getAuthUser } from "@/lib/auth/session";
import { decideApprovalRequest } from "@/services/ai/approval-service";
import { executeApprovedWhatsappAction } from "@/tools/whatsapp-approval-executor";

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

async function requireAdmin(): Promise<
  { ok: true; userId: string } | { ok: false; error: string }
> {
  const user = await getAuthUser();
  if (!user) return { ok: false, error: "You must be signed in." };
  if (user.role !== "admin") {
    return { ok: false, error: "Admin access required." };
  }
  return { ok: true, userId: user.id };
}

/**
 * Approve or reject a pending AI action approval. On approval, the frozen
 * execution payload captured at request time is re-executed (e.g. the exact
 * WhatsApp message the AI intended to send) so only the approved operation
 * runs — never a future, possibly-different request.
 */
export async function decideApprovalAction(
  approvalId: string,
  approve: boolean,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const result = await decideApprovalRequest({
    approvalId,
    decisionBy: auth.userId,
    approve,
    executor: approve
      ? async (execution) => {
          const outcome = await executeApprovedWhatsappAction(execution);
          return outcome.ok
            ? { ok: true }
            : { ok: false, error: outcome.error };
        }
      : undefined,
  });

  if (!result.ok) return result;

  revalidatePath("/admin/ai");
  revalidatePath("/admin/integrations");
  return { ok: true, message: result.message };
}
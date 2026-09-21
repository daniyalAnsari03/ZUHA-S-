"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";

import { getAuthUser } from "@/lib/auth/session";
import type { ActionResult } from "@/app/admin/actions";
import { sendReportEmail } from "@/services/email/email.service";
import {
  getReportEmailAddress,
  setReportEmailAddress,
} from "@/services/email/store-settings-service";
import { ServiceError } from "@/services/base";

function errorText(error: unknown): string {
  if (error instanceof ServiceError) return error.message;
  if (error instanceof ZodError) {
    return error.issues.map((issue) => issue.message).join(" ");
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}

/**
 * Save the report recipient email for the automated reporting engine.
 * Admin-only; verified (re-read) after saving.
 */
export async function updateReportEmailAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") {
    return { ok: false, error: "Admin access required." };
  }

  const raw = formData.get("email");
  const email = typeof raw === "string" ? raw.trim() : "";

  try {
    await setReportEmailAddress(email || null);
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }

  revalidatePath("/admin/reports");
  return {
    ok: true,
    message: email
      ? "Report email address saved."
      : "Report email address cleared. Reports will fail until one is set.",
  };
}

/**
 * Send a report email now from the Admin Panel. Falls back to the signed-in
 * admin's email when no store recipient is configured yet.
 */
export async function sendReportNowAction(
  reportType: "daily" | "weekly",
): Promise<ActionResult & { subject?: string; recipient?: string }> {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") {
    return { ok: false, error: "Admin access required." };
  }

  try {
    const result = await sendReportEmail({
      reportType,
      source: "admin",
      requestedBy: user.id,
      fallbackRecipient: user.email,
    });

    if (!result.ok) {
      return { ok: false, error: result.message };
    }

    revalidatePath("/admin/reports");
    return {
      ok: true,
      message: `Report sent to ${result.recipient}.`,
      subject: result.subject,
      recipient: result.recipient,
    };
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
}

/** Read the current report recipient (server-side read for the page). */
export async function getReportRecipientAction(): Promise<{
  email: string | null;
}> {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") {
    return { email: null };
  }
  try {
    return { email: await getReportEmailAddress() };
  } catch (error) {
    console.error("[admin/reports] read recipient failed:", error);
    return { email: null };
  }
}
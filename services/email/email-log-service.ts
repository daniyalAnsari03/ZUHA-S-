import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Database,
  EmailLogSource,
  EmailLogStatus,
} from "@/lib/supabase/types";
import type { RiskLevel } from "@/lib/security/guardians";
import { ServiceError } from "@/services/base";

/**
 * Email logging — the durable audit trail for every report email
 * (email_logs table).
 *
 * Every send is written first as 'pending', then flipped to 'sent' (with the
 * provider message id) or 'failed' (with the failure reason). This gives a
 * fail-closed trail: a send that never completes stays 'pending' and is
 * visible in the Admin UI, and a failed provider call is recorded as 'failed'
 * instead of silently disappearing.
 *
 * SECURITY: the service-role client is used because sends happen from
 * authorized server paths that may have no user session (cron, AI tools).
 * Callers must complete authorization before calling.
 *
 * TIME: "today" uses Pakistan Time, matching how the business day is
 * defined everywhere else in the project.
 */

type EmailLogRow = Database["public"]["Tables"]["email_logs"]["Row"];

export type EmailLogEntry = {
  recipientEmail: string;
  reportType: "daily" | "weekly" | "manual";
  subject: string;
  aiSummary?: string | null;
  source: EmailLogSource;
  riskLevel: RiskLevel;
  requestedBy?: string | null;
};

/** PKT date key of "today" for log-bucket checks. */
function pktTodayKey(): string {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Karachi" }),
  )
    .toISOString()
    .slice(0, 10);
}

/**
 * PKT midnight as a UTC instant (PKT = UTC+5, so 00:00 PKT = 19:00 UTC the
 * previous day). Used to filter logs created "since the start of the PKT day".
 */
function pktDayStartUTC(): string {
  const [y, m, d] = pktTodayKey().split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1, 19, 0, 0)).toISOString();
}

export async function createPendingEmailLog(
  entry: EmailLogEntry,
): Promise<string> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("email_logs")
    .insert({
      recipient_email: entry.recipientEmail,
      report_type: entry.reportType,
      subject: entry.subject,
      status: "pending",
      ai_summary: entry.aiSummary ?? null,
      source: entry.source,
      risk_level: entry.riskLevel,
      requested_by: entry.requestedBy ?? null,
    })
    .select("id")
    .single();

  if (error) {
    throw new ServiceError(
      "EMAIL_LOG_CREATE_FAILED",
      "Failed to record the email attempt.",
      error,
    );
  }

  return data.id;
}

export async function markEmailLogSent(
  emailLogId: string,
  providerMessageId: string | null,
): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("email_logs")
    .update({
      status: "sent",
      provider_message_id: providerMessageId,
      sent_at: new Date().toISOString(),
    })
    .eq("id", emailLogId);

  if (error) {
    throw new ServiceError(
      "EMAIL_LOG_UPDATE_FAILED",
      "Failed to record the sent email.",
      error,
    );
  }
}

export async function markEmailLogFailed(
  emailLogId: string,
  message: string,
): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("email_logs")
    .update({
      status: "failed",
      error_message: message.slice(0, 500),
    })
    .eq("id", emailLogId);

  if (error) {
    console.error("[email-log] failed to record failure:", error.message);
  }
}

export async function getEmailLogStatus(
  emailLogId: string,
): Promise<EmailLogStatus | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("email_logs")
    .select("status")
    .eq("id", emailLogId)
    .maybeSingle();

  if (error) {
    throw new ServiceError(
      "EMAIL_LOG_READ_FAILED",
      "Failed to verify the email log status.",
      error,
    );
  }

  return data ? (data.status as EmailLogStatus) : null;
}

/**
 * True when a pending/sent run of this report type already exists today PKT.
 * Used by the cron engine so a daily/weekly report is never double-sent.
 */
export async function hasProcessedReportToday(
  reportType: "daily" | "weekly",
): Promise<boolean> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("email_logs")
    .select("id")
    .eq("report_type", reportType)
    .in("status", ["pending", "sent"])
    .gte("created_at", pktDayStartUTC())
    .limit(1);

  if (error) {
    return false;
  }

  return (data?.length ?? 0) > 0;
}

export async function listEmailLogs(
  options?: { limit?: number },
): Promise<EmailLogRow[]> {
  const supabase = createAdminClient();
  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 100);

  const { data, error } = await supabase
    .from("email_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new ServiceError(
      "EMAIL_LOG_LIST_FAILED",
      "Failed to load email logs.",
      error,
    );
  }

  return (data ?? []) as EmailLogRow[];
}
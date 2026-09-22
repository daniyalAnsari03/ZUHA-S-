import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Database,
  EmailLogSource,
  EmailLogStatus,
} from "@/lib/supabase/types";
import type { RiskLevel } from "@/lib/security/guardians";
import { ServiceError } from "@/services/base";

const EMAIL_LOG_INSERT_CONFLICT_CODE = "23505";

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

export type ReportType = "daily" | "weekly" | "monthly" | "manual";

export type EmailLogEntry = {
  recipientEmail: string;
  reportType: ReportType;
  subject: string;
  aiSummary?: string | null;
  source: EmailLogSource;
  riskLevel: RiskLevel;
  requestedBy?: string | null;
  /** Stable identity of the report PERIOD this row belongs to (see
   * `reportPeriodKey` in report-data-service). Set by cron so duplicate-send
   * protection is race-safe at the database level. */
  periodKey?: string | null;
};

/** PKT date key of "today" for log-bucket checks. */
function pktTodayKey(): string {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Karachi" }),
  )
    .toISOString()
    .slice(0, 10);
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
      period_key: entry.periodKey ?? null,
    })
    .select("id")
    .single();

  if (error) {
    // Unique-violation: a pending/sent cron row already exists for the same
    // report period. Thrown as a dedicated service error so the caller can
    // report the run as skipped instead of sending a duplicate email.
    if (error.code === EMAIL_LOG_INSERT_CONFLICT_CODE) {
      throw new ServiceError(
        "EMAIL_LOG_PERIOD_DUPLICATE",
        "A report for this period was already sent. The duplicate send was skipped.",
      );
    }
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
 * True when a pending/sent run of this report type already exists for the
 * given report PERIOD key (see `reportPeriodKey`). Used by the cron engine so
 * a daily/weekly/monthly report is never double-sent for the same period.
 * `periodKey` is null-tolerant: null matches no rows (admin/manual sends do not
 * rely on this check).
 */
export async function hasProcessedReportPeriod(
  reportType: "daily" | "weekly" | "monthly",
  periodKey: string | null,
): Promise<boolean> {
  if (!periodKey) return false;
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("email_logs")
    .select("id")
    .eq("report_type", reportType)
    .eq("period_key", periodKey)
    .in("status", ["pending", "sent"])
    .limit(1);

  if (error) {
    return false;
  }

  return (data?.length ?? 0) > 0;
}

/**
 * Legacy per-day check kept for compatibility with callers that bucket by the
 * PKT calendar day. For daily/weekly reports this is now expressed via
 * `hasProcessedReportPeriod` with the exact period key.
 */
export async function hasProcessedReportToday(
  reportType: "daily" | "weekly",
): Promise<boolean> {
  return hasProcessedReportPeriod(reportType, pktTodayKey());
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
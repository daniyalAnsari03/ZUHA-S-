import { render } from "@react-email/components";
import { Resend } from "resend";

import { classifyEmailReportSend } from "@/guardians/email";
import type { RiskLevel } from "@/lib/security/guardians";
import { ServiceError } from "@/services/base";

import {
  buildDailySalesSummary,
  buildWeeklySalesSummary,
  buildReportSubject,
  type DailySalesSummary,
  type WeeklySalesSummary,
} from "./report-data-service";
import { generateReportInsight } from "./report-insight-service";
import {
  createPendingEmailLog,
  getEmailLogStatus,
  markEmailLogFailed,
  markEmailLogSent,
} from "./email-log-service";
import { resolveReportRecipient } from "./store-settings-service";

import DailyReportEmail from "@/emails/DailyReport";
import WeeklyReportEmail from "@/emails/WeeklyReport";

export type ReportKind = "daily" | "weekly";

export type SendReportEmailOptions = {
  reportType: ReportKind;
  source: "cron" | "admin" | "ai";
  /** auth user id of the requesting actor (admin/ai) or null for cron. */
  requestedBy?: string | null;
  /** fallback recipient used when no store setting is configured (admin UI). */
  fallbackRecipient?: string | null;
};

export type SendReportEmailResult =
  | {
    ok: true;
    emailLogId: string;
    recipient: string;
    subject: string;
    aiInsight: string;
    providerMessageId: string | null;
    riskLevel: RiskLevel;
  }
  | {
    ok: false;
    reason: string;
    message: string;
    emailLogId?: string;
  };

function fail(
  reason: string,
  message: string,
  emailLogId?: string,
): SendReportEmailResult {
  return { ok: false, reason, message, ...(emailLogId ? { emailLogId } : {}) };
}

/** JSON-safe summary handed to the insight agent — numbers only, no secrets. */
function summaryJson(
  reportType: ReportKind,
  summary: DailySalesSummary | WeeklySalesSummary,
): string {
  if (reportType === "daily" && summary.reportType === "daily") {
    return JSON.stringify({
      reportType: "daily",
      date: summary.dateKey,
      revenue: summary.revenue,
      orderCount: summary.orderCount,
      averageOrderValue: summary.averageOrderValue,
      topProducts: summary.topProducts.map((p) => ({
        name: p.name,
        unitsSold: p.unitsSold,
        revenue: p.revenue,
      })),
      lowStock: summary.lowStock.map((p) => ({
        name: p.name,
        stockQuantity: p.stockQuantity,
        threshold: p.lowStockThreshold,
      })),
    });
  }

  const weekly = summary as WeeklySalesSummary;
  return JSON.stringify({
    reportType: "weekly",
    week: weekly.weekLabel,
    revenue: weekly.revenue,
    previousRevenue: weekly.previousRevenue,
    revenueGrowthPercent: weekly.revenueGrowthPercent,
    orderCount: weekly.orderCount,
    previousOrderCount: weekly.previousOrderCount,
    bestSellers: weekly.bestSellers.map((p) => ({
      name: p.name,
      unitsSold: p.unitsSold,
      revenue: p.revenue,
    })),
    lowStock: weekly.lowStock.map((p) => ({
      name: p.name,
      stockQuantity: p.stockQuantity,
      threshold: p.lowStockThreshold,
    })),
  });
}

/**
 * Build and send a business report email (daily/weekly) through Resend.
 *
 * End-to-end flow (fail-closed):
 *   1. Guardian — classify the send source; unverified sources are blocked.
 *   2. Recipient — configured store address (or the admin fallback), never
 *      guessed; unset recipient fails the send before anything is attempted.
 *   3. Data — real summary built from the database (revenue rule applies).
 *   4. Insight — AI 3-line analysis; empty/failed insight aborts the send.
 *   5. Audit — an email_logs 'pending' row is created BEFORE the provider call.
 *   6. Send — Resend; result is recorded as 'sent' (with message id) or
 *      'failed' (with reason) and re-read to VERIFY the recorded status.
 */
export async function sendReportEmail(
  options: SendReportEmailOptions,
): Promise<SendReportEmailResult> {
  const { reportType, source } = options;

  const guardian = classifyEmailReportSend(source);
  if (!guardian.allowed) {
    return fail("blocked", guardian.reason ?? "Report send blocked.");
  }

  try {
    const recipient = await resolveReportRecipient(options.fallbackRecipient);
    if (!recipient) {
      return fail(
        "no_recipient",
        "No report email address is configured. Set one in Admin → Email Reports, then try again.",
      );
    }

    const summary =
      reportType === "daily"
        ? await buildDailySalesSummary()
        : await buildWeeklySalesSummary();
    const subject = buildReportSubject(reportType, summary);

    const insight = await generateReportInsight(
      reportType,
      summaryJson(reportType, summary),
    );

    let html: string;
    if (summary.reportType === "daily") {
      html = await render(
        DailyReportEmail({
          dateLabel: summary.dateLabel,
          revenue: summary.revenue,
          orderCount: summary.orderCount,
          averageOrderValue: summary.averageOrderValue,
          topProducts: summary.topProducts,
          lowStock: summary.lowStock,
          aiInsight: insight,
        }),
      );
    } else {
      html = await render(
        WeeklyReportEmail({
          weekLabel: summary.weekLabel,
          revenue: summary.revenue,
          previousRevenue: summary.previousRevenue,
          revenueGrowthPercent: summary.revenueGrowthPercent ?? 0,
          orderCount: summary.orderCount,
          previousOrderCount: summary.previousOrderCount,
          bestSellers: summary.bestSellers,
          lowStock: summary.lowStock,
          aiInsight: insight,
        }),
      );
    }

    const emailLogId = await createPendingEmailLog({
      recipientEmail: recipient,
      reportType,
      subject,
      aiSummary: insight,
      source,
      riskLevel: guardian.risk,
      requestedBy: options.requestedBy ?? null,
    });

    // Env-config check AFTER the pending log is recorded so the failure is
    // always visible in Admin → Email Reports.
    const apiKey = process.env.RESEND_API_KEY;
    const fromAddress = process.env.EMAIL_REPORT_FROM;
    if (!apiKey || !fromAddress) {
      const message = !apiKey
        ? "RESEND_API_KEY is not configured on the server."
        : "EMAIL_REPORT_FROM is not configured on the server.";
      await markEmailLogFailed(emailLogId, message);
      return fail("not_configured", message, emailLogId);
    }

    let providerMessageId: string | null = null;
    try {
      const resend = new Resend(apiKey);
      const { data, error } = await resend.emails.send({
        from: fromAddress,
        to: [recipient],
        subject,
        html,
      });
      if (error) {
        const message = error.message || "Resend rejected the email.";
        await markEmailLogFailed(emailLogId, message);
        return fail("send_failed", `The email could not be sent: ${message}`, emailLogId);
      }
      providerMessageId = data?.id ?? null;
    } catch (error) {
      console.error("[email.service] provider send failed:", error);
      const message = "An unexpected error occurred while sending the email.";
      await markEmailLogFailed(emailLogId, message);
      return fail("send_failed", message, emailLogId);
    }

    await markEmailLogSent(emailLogId, providerMessageId);

    // VERIFY: confirm the recorded status actually says 'sent'.
    const recorded = await getEmailLogStatus(emailLogId);
    if (recorded !== "sent") {
      const message =
        "The email was handed to the provider, but the send status could not be verified.";
      await markEmailLogFailed(emailLogId, message);
      return fail("verify_failed", message, emailLogId);
    }

    return {
      ok: true,
      emailLogId,
      recipient,
      subject,
      aiInsight: insight,
      providerMessageId,
      riskLevel: guardian.risk,
    };
  } catch (error) {
    if (error instanceof ServiceError) {
      return fail("service_error", error.message);
    }
    console.error("[email.service] unexpected failure:", error);
    return fail(
      "service_error",
      "An unexpected error occurred while preparing the report email.",
    );
  }
}
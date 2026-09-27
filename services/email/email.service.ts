import { render } from "@react-email/components";
import { Resend } from "resend";

import { classifyEmailReportSend } from "@/guardians/email";
import type { RiskLevel } from "@/lib/security/guardians";
import { ServiceError } from "@/services/base";

import {
  buildDailySalesSummary,
  buildMonthlySalesSummary,
  buildWeeklySalesSummary,
  buildReportSubject,
  reportPeriodKey,
  type DailySalesSummary,
  type MonthlySalesSummary,
  type WeeklySalesSummary,
} from "./report-data-service";
import { generateReportInsight } from "./report-insight-service";
import {
  buildPlainReportInsight,
  insightNumbersMatch,
} from "./insight-sanitization";
import {
  createPendingEmailLog,
  getEmailLogStatus,
  markEmailLogFailed,
  markEmailLogSent,
} from "./email-log-service";
import { resolveReportRecipient } from "./store-settings-service";

import DailyReportEmail from "@/emails/DailyReport";
import WeeklyReportEmail from "@/emails/WeeklyReport";
import MonthlyReportEmail from "@/emails/MonthlyReport";

export type ReportKind = "daily" | "weekly" | "monthly";

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
      periodKey: string;
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
  summary: DailySalesSummary | WeeklySalesSummary | MonthlySalesSummary,
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

  if (reportType === "weekly" && summary.reportType === "weekly") {
    return JSON.stringify({
      reportType: "weekly",
      week: summary.weekLabel,
      revenue: summary.revenue,
      previousRevenue: summary.previousRevenue,
      revenueGrowthPercent: summary.revenueGrowthPercent,
      orderCount: summary.orderCount,
      previousOrderCount: summary.previousOrderCount,
      bestSellers: summary.bestSellers.map((p) => ({
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

  const monthly = summary as MonthlySalesSummary;
  return JSON.stringify({
    reportType: "monthly",
    month: monthly.monthLabel,
    revenue: monthly.revenue,
    previousRevenue: monthly.previousRevenue,
    revenueGrowthPercent: monthly.revenueGrowthPercent,
    orderCount: monthly.orderCount,
    previousOrderCount: monthly.previousOrderCount,
    bestSellers: monthly.bestSellers.map((p) => ({
      name: p.name,
      unitsSold: p.unitsSold,
      revenue: p.revenue,
    })),
    lowStock: monthly.lowStock.map((p) => ({
      name: p.name,
      stockQuantity: p.stockQuantity,
      threshold: p.lowStockThreshold,
    })),
  });
}

/**
 * Build and send a business report email (daily/weekly/monthly) through Resend.
 *
 * End-to-end flow (fail-closed):
 *   1. Guardian — classify the send source; unverified sources are blocked.
 *   2. Recipient — configured store address (or the admin fallback), never
 *      guessed; unset recipient fails the send before anything is attempted.
 *   3. Data — real summary built from the database (revenue rule applies).
 *   4. Insight — AI 3-line analysis; empty/failed insight aborts the send.
 *      Every number the AI writes is then verified against the real data; on
 *      any mismatch the email falls back to a plain templated message built
 *      only from the raw numbers.
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
        : reportType === "weekly"
          ? await buildWeeklySalesSummary()
          : await buildMonthlySalesSummary();
    const subject = buildReportSubject(reportType, summary);
    const periodKey = reportPeriodKey(reportType);

    const insight = await generateReportInsight(
      reportType,
      summaryJson(reportType, summary),
    );

    // TRUTH CHECK: every number the AI wrote must exist in the real summary.
    // If any does not, fall back to a plain templated message built only from
    // the raw data — a report email must never carry a fabricated figure.
    const verifiedInsight = insightNumbersMatch(summary, insight)
      ? insight
      : buildPlainReportInsight(reportType, summary);

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
          aiInsight: verifiedInsight,
        }),
      );
    } else if (summary.reportType === "weekly") {
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
          aiInsight: verifiedInsight,
        }),
      );
    } else {
      html = await render(
        MonthlyReportEmail({
          monthLabel: summary.monthLabel,
          revenue: summary.revenue,
          previousRevenue: summary.previousRevenue,
          revenueGrowthPercent: summary.revenueGrowthPercent ?? 0,
          orderCount: summary.orderCount,
          previousOrderCount: summary.previousOrderCount,
          bestSellers: summary.bestSellers,
          lowStock: summary.lowStock,
          aiInsight: verifiedInsight,
        }),
      );
    }

    let emailLogId: string;
    try {
      emailLogId = await createPendingEmailLog({
        recipientEmail: recipient,
        reportType,
        subject,
        aiSummary: verifiedInsight,
        source,
        riskLevel: guardian.risk,
        requestedBy: options.requestedBy ?? null,
        periodKey,
      });
    } catch (error) {
      if (
        error instanceof ServiceError &&
        error.code === "EMAIL_LOG_PERIOD_DUPLICATE"
      ) {
        // A pending/sent cron run of the same period already exists — never
        // send a duplicate for the same report period.
        return fail("already_sent", error.message);
      }
      throw error;
    }

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
        return fail(
          "send_failed",
          `The email could not be sent: ${message}`,
          emailLogId,
        );
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
      aiInsight: verifiedInsight,
      periodKey,
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

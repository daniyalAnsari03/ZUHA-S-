import { NextRequest } from "next/server";

import { hasProcessedReportPeriod } from "@/services/email/email-log-service";
import { sendReportEmail } from "@/services/email/email.service";
import { reportPeriodKey } from "@/services/email/report-data-service";

const REPORT_TYPES = ["daily", "weekly", "monthly"] as const;
type ReportType = (typeof REPORT_TYPES)[number];

/**
 * GET /api/cron/generate-reports?type=daily|weekly|monthly
 *
 * Vercel CRON endpoint — the automated report engine. Sends the configured
 * business report email (daily/weekly/monthly) built from real database data
 * plus an AI insight, and records/verifies the send in email_logs.
 *
 * SECURITY (fail-closed):
 *  - Only the real Vercel CRON scheduler (`x-vercel-cron: 1`) or a caller with
 *    `Authorization: Bearer ${CRON_SECRET}` may invoke this route.
 *  - If CRON_SECRET is not configured and the request is not a genuine Vercel
 *    CRON call, the route refuses to run (503/401).
 *  - Idempotency: if the requested report type already has a pending/sent run
 *    for the same report period, the request is skipped instead of
 *    double-sending. The app-level check runs before the send AND a unique
 *    index on email_logs (report_type, period_key) WHERE source = 'cron' is
 *    the race-safe database backstop.
 *
 * Env required for delivery: RESEND_API_KEY, EMAIL_REPORT_FROM (and a
 * configured report recipient in store_settings, or set from Admin UI).
 */
export async function GET(request: NextRequest) {
  const isVercelCron = request.headers.get("x-vercel-cron") === "1";

  const cronSecret = process.env.CRON_SECRET;
  if (!isVercelCron) {
    if (!cronSecret) {
      return new Response(
        JSON.stringify({
          error:
            "CRON_SECRET is not configured. Add it to your server env, or verify this is a genuine Vercel CRON invocation.",
        }),
        { status: 503, headers: { "content-type": "application/json" } },
      );
    }
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return new Response(JSON.stringify({ error: "Unauthorized." }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }
  }

  const { searchParams } = new URL(request.url);
  const typeParam = searchParams.get("type") ?? "daily";
  if (!REPORT_TYPES.includes(typeParam as ReportType)) {
    return new Response(
      JSON.stringify({
        error: 'Invalid type. Use "daily", "weekly" or "monthly".',
      }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }
  const reportType = typeParam as ReportType;

  try {
    const periodKey = reportPeriodKey(reportType);
    const alreadySent = await hasProcessedReportPeriod(reportType, periodKey);
    if (alreadySent) {
      return new Response(
        JSON.stringify({
          ok: true,
          skipped: true,
          reportType,
          periodKey,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }

    const result = await sendReportEmail({ reportType, source: "cron" });

    if (!result.ok) {
      if (result.reason === "already_sent") {
        // Race-safe backstop: the unique index caught a concurrent duplicate.
        console.log(
          `[cron] ${reportType} report skipped (already sent for period).`,
        );
        return new Response(
          JSON.stringify({
            ok: true,
            skipped: true,
            reportType,
            periodKey,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      console.error(
        `[cron] ${reportType} report failed:`,
        result.reason,
        result.message,
      );
      return new Response(
        JSON.stringify({
          ok: false,
          reason: result.reason,
          message: result.message,
        }),
        { status: 500, headers: { "content-type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        skipped: false,
        reportType,
        periodKey,
        emailLogId: result.emailLogId,
        recipient: result.recipient,
        subject: result.subject,
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  } catch (error) {
    console.error("[cron] generate-reports failed:", error);
    return new Response(
      JSON.stringify({
        ok: false,
        reason: "error",
        message: "The report engine failed unexpectedly.",
      }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }
}

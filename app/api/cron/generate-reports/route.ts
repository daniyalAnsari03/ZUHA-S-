import { NextRequest } from "next/server";

import { hasProcessedReportToday } from "@/services/email/email-log-service";
import { sendReportEmail } from "@/services/email/email.service";

/**
 * GET /api/cron/generate-reports?type=daily|weekly
 *
 * Vercel CRON endpoint — the automated report engine. Sends the configured
 * business report email (daily/weekly) built from real database data plus an
 * AI insight, and records/verifies the send in email_logs.
 *
 * SECURITY (fail-closed):
 *  - Only the real Vercel CRON scheduler (`x-vercel-cron: 1`) or a caller with
 *    `Authorization: Bearer ${CRON_SECRET}` may invoke this route.
 *  - If CRON_SECRET is not configured and the request is not a genuine Vercel
 *    CRON call, the route refuses to run (503/401).
 *  - Idempotency: if the requested report type already has a pending/sent run
 *    today (PKT), the request is skipped instead of double-sending.
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
          error: "CRON_SECRET is not configured. Add it to your server env, or verify this is a genuine Vercel CRON invocation.",
        }),
        { status: 503, headers: { "content-type": "application/json" } },
      );
    }
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return new Response(
        JSON.stringify({ error: "Unauthorized." }),
        { status: 401, headers: { "content-type": "application/json" } },
      );
    }
  }

  const { searchParams } = new URL(request.url);
  const typeParam = searchParams.get("type") ?? "daily";
  if (typeParam !== "daily" && typeParam !== "weekly") {
    return new Response(
      JSON.stringify({ error: 'Invalid type. Use "daily" or "weekly".' }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }

  try {
    const alreadySent = await hasProcessedReportToday(typeParam);
    if (alreadySent) {
      return new Response(
        JSON.stringify({ ok: true, skipped: true, reportType: typeParam }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }

    const result = await sendReportEmail({ reportType: typeParam, source: "cron" });

    if (!result.ok) {
      console.error(`[cron] ${typeParam} report failed:`, result.reason, result.message);
      return new Response(
        JSON.stringify({ ok: false, reason: result.reason, message: result.message }),
        { status: 500, headers: { "content-type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        skipped: false,
        reportType: typeParam,
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
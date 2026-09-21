import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FileText } from "lucide-react";

import { getAuthUser } from "@/lib/auth/session";
import { getReportRecipientAction } from "@/app/admin/reports/actions";
import { EmailReportsClient } from "@/app/admin/reports/email-reports-client";
import { listEmailLogs } from "@/services/email/email-log-service";

export const metadata: Metadata = {
  title: "Email Reports · Admin",
  robots: { index: false, follow: false },
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  sent: "bg-emerald-100 text-emerald-800",
  failed: "bg-red-100 text-red-800",
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}

export default async function AdminEmailReportsPage() {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") redirect("/login");

  const { email } = await getReportRecipientAction();

  let logs: Awaited<ReturnType<typeof listEmailLogs>> = [];
  let errorShown = false;
  try {
    logs = await listEmailLogs({ limit: 25 });
  } catch (error) {
    errorShown = true;
    console.error("[admin] email logs load failed:", error);
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-charcoal">Email Reports</h1>
          <p className="mt-1 text-sm text-charcoal-muted">
            Automated business report emails (daily/weekly) with AI insights.
            Delivered via Resend; every send is audited below.
          </p>
        </div>
      </div>

      <EmailReportsClient recipient={email} />

      {/* Logs */}
      <section className="mt-10">
        <h2 className="font-serif text-xl text-charcoal">Send History</h2>
        <p className="mt-1 text-sm text-charcoal-muted">
          Audit trail of every report email, including automated cron runs and
          AI-requested sends.
        </p>

        {errorShown ? (
          <div className="mt-4 rounded-xl border border-charcoal/10 bg-neutral-soft p-10 text-center text-sm text-charcoal-muted">
            Email logs could not be loaded right now.
          </div>
        ) : logs.length === 0 ? (
          <div className="mt-4 rounded-xl border border-charcoal/10 bg-neutral-soft p-10 text-center">
            <FileText className="mx-auto h-10 w-10 text-charcoal-muted/40" aria-hidden="true" />
            <p className="mt-3 text-sm text-charcoal-muted">
              No report emails sent yet. Send one above or wait for the daily
              cron schedule.
            </p>
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-charcoal/5 overflow-hidden rounded-xl border border-charcoal/10 bg-neutral-soft">
            {logs.map((log) => (
              <li key={log.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-plum/10 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-plum">
                    {log.report_type}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide ${STATUS_STYLES[log.status]}`}
                  >
                    {log.status}
                  </span>
                  <span className="text-xs text-charcoal-muted">
                    {timeAgo(log.created_at)}
                    {log.sent_at ? ` · sent ${timeAgo(log.sent_at)}` : ""}
                  </span>
                </div>
                <p className="mt-1.5 text-sm font-medium text-charcoal">{log.subject}</p>
                <p className="text-xs text-charcoal-muted">{log.recipient_email}</p>
                {log.ai_summary && (
                  <p className="mt-2 line-clamp-2 text-sm text-charcoal-muted">
                    {log.ai_summary}
                  </p>
                )}
                {log.error_message && (
                  <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">
                    {log.error_message}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
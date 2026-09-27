"use client";

import { useActionState } from "react";
import { CheckCircle2, Mail, Send, TriangleAlert } from "lucide-react";

import type { ActionResult } from "@/app/admin/actions";
import {
  sendReportNowAction,
  updateReportEmailAction,
} from "@/app/admin/reports/actions";

type EmailReportsClientProps = {
  recipient: string | null;
};

function ResultBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      className="flex items-start gap-3 rounded-xl border border-plum/15 bg-cream px-4 py-3 text-sm text-charcoal"
      role="status"
    >
      <CheckCircle2
        className="mt-0.5 h-4 w-4 shrink-0 text-plum"
        aria-hidden="true"
      />
      <span>{message}</span>
    </div>
  );
}

function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      className="flex items-start gap-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
      role="alert"
    >
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

export function EmailReportsClient({ recipient }: EmailReportsClientProps) {
  const [saveState, saveFormAction, savePending] = useActionState(
    updateReportEmailAction,
    { ok: true } satisfies ActionResult,
  );

  const [dailyState, dailyFormAction, dailyPending] = useActionState(
    sendReportNowAction.bind(null, "daily"),
    { ok: true } satisfies ActionResult,
  );

  const [weeklyState, weeklyFormAction, weeklyPending] = useActionState(
    sendReportNowAction.bind(null, "weekly"),
    { ok: true } satisfies ActionResult,
  );

  const [monthlyState, monthlyFormAction, monthlyPending] = useActionState(
    sendReportNowAction.bind(null, "monthly"),
    { ok: true } satisfies ActionResult,
  );

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      {/* Recipient */}
      <section className="rounded-xl border border-charcoal/10 bg-neutral-soft p-6">
        <h2 className="flex items-center gap-2 font-serif text-xl text-charcoal">
          <Mail className="h-5 w-5 text-plum" aria-hidden="true" />
          Report Email Address
        </h2>
        <p className="mt-1 text-sm text-charcoal-muted">
          The automated daily/weekly/monthly reports and on-demand sends are
          delivered to this address.
        </p>

        <form action={saveFormAction} className="mt-4 space-y-3">
          <label
            htmlFor="report-email"
            className="block text-xs font-semibold uppercase tracking-wider text-charcoal-muted/80"
          >
            Recipient email
          </label>
          <input
            id="report-email"
            name="email"
            type="email"
            placeholder="you@example.com"
            defaultValue={recipient ?? ""}
            className="w-full rounded-lg border border-charcoal/15 bg-white px-3 py-2 text-sm text-charcoal outline-none transition-colors focus:border-plum focus:ring-1 focus:ring-plum"
          />
          <button
            type="submit"
            disabled={savePending}
            className="inline-flex items-center gap-1.5 rounded-full bg-plum px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-plum-dark disabled:opacity-60"
          >
            {savePending ? "Saving…" : "Save address"}
          </button>
        </form>

        <div className="mt-4">
          <ResultBanner
            message={saveState.ok ? (saveState.message ?? null) : null}
          />
          <ErrorBanner message={saveState.ok ? null : saveState.error} />
        </div>

        {!recipient && (
          <p className="mt-3 rounded-lg bg-cream px-3 py-2 text-xs text-charcoal-muted">
            No address configured yet — reports will fail until you save one.
          </p>
        )}
      </section>

      {/* Send now */}
      <section className="rounded-xl border border-charcoal/10 bg-neutral-soft p-6">
        <h2 className="flex items-center gap-2 font-serif text-xl text-charcoal">
          <Send className="h-5 w-5 text-plum" aria-hidden="true" />
          Send Now
        </h2>
        <p className="mt-1 text-sm text-charcoal-muted">
          Generate a real report from the database, add an AI insight, send it
          by email and record it in the audit log.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <form action={dailyFormAction}>
            <button
              type="submit"
              disabled={dailyPending}
              className="w-full rounded-xl border border-plum/25 bg-neutral-soft px-4 py-3 text-left transition-colors hover:border-plum hover:bg-cream disabled:opacity-60"
            >
              <span className="block text-sm font-semibold text-plum">
                {dailyPending ? "Sending…" : "Send Daily Report"}
              </span>
              <span className="mt-0.5 block text-xs text-charcoal-muted">
                Today (PKT) summary
              </span>
            </button>
          </form>
          <form action={weeklyFormAction}>
            <button
              type="submit"
              disabled={weeklyPending}
              className="w-full rounded-xl border border-plum/25 bg-neutral-soft px-4 py-3 text-left transition-colors hover:border-plum hover:bg-cream disabled:opacity-60"
            >
              <span className="block text-sm font-semibold text-plum">
                {weeklyPending ? "Sending…" : "Send Weekly Report"}
              </span>
              <span className="mt-0.5 block text-xs text-charcoal-muted">
                Trailing 7 days (PKT)
              </span>
            </button>
          </form>
          <form action={monthlyFormAction}>
            <button
              type="submit"
              disabled={monthlyPending}
              className="w-full rounded-xl border border-plum/25 bg-neutral-soft px-4 py-3 text-left transition-colors hover:border-plum hover:bg-cream disabled:opacity-60"
            >
              <span className="block text-sm font-semibold text-plum">
                {monthlyPending ? "Sending…" : "Send Monthly Report"}
              </span>
              <span className="mt-0.5 block text-xs text-charcoal-muted">
                Current month (PKT)
              </span>
            </button>
          </form>
        </div>

        <div className="mt-4 space-y-2">
          {dailyState.ok && dailyState.message && (
            <ResultBanner message={`Daily: ${dailyState.message}`} />
          )}
          {!dailyState.ok && (
            <ErrorBanner message={`Daily: ${dailyState.error}`} />
          )}
          {weeklyState.ok && weeklyState.message && (
            <ResultBanner message={`Weekly: ${weeklyState.message}`} />
          )}
          {!weeklyState.ok && (
            <ErrorBanner message={`Weekly: ${weeklyState.error}`} />
          )}
          {monthlyState.ok && monthlyState.message && (
            <ResultBanner message={`Monthly: ${monthlyState.message}`} />
          )}
          {!monthlyState.ok && (
            <ErrorBanner message={`Monthly: ${monthlyState.error}`} />
          )}
        </div>
      </section>
    </div>
  );
}

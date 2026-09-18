"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  Mails,
  ShieldCheck,
  XCircle,
} from "lucide-react";

type Decision = {
  id: string;
  agent_name: string;
  tool_name: string | null;
  action_type: string;
  risk: "low" | "medium" | "high";
  decision: "allow" | "deny" | "require_approval";
  reason: string | null;
  execution_status:
    | "pending"
    | "approved_pending"
    | "executed"
    | "blocked"
    | "failed"
    | "skipped";
  created_at: string;
};

const DECISION_ICONS: Record<string, typeof ShieldCheck> = {
  allow: CheckCircle,
  deny: XCircle,
  require_approval: Mails,
};

const DECISION_COLORS: Record<string, string> = {
  allow: "text-green-600 bg-green-50",
  deny: "text-red-600 bg-red-50",
  require_approval: "text-amber-600 bg-amber-50",
};

const EXECUTION_COLORS: Record<string, string> = {
  executed: "text-green-700",
  approved_pending: "text-amber-600",
  blocked: "text-red-600",
  failed: "text-red-600",
  pending: "text-charcoal-muted",
  skipped: "text-charcoal-muted",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function GuardianDecisionViewer() {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/ai/guardian-decisions?limit=20");
        if (!res.ok) {
          if (!cancelled) setError("Failed to load Guardian decisions.");
          return;
        }
        const data = await res.json();
        if (!cancelled) setDecisions(data.decisions ?? []);
      } catch {
        if (!cancelled) setError("Could not load Guardian decisions.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="rounded-2xl border border-charcoal/10 bg-white p-5">
      <div className="flex items-center gap-2">
        <h2 className="font-serif text-base text-charcoal">Guardian decisions</h2>
        <ShieldCheck className="h-4 w-4 text-plum" aria-hidden="true" />
      </div>
      <p className="mt-1 text-xs text-charcoal-muted">
        Every AI action is evaluated by the Guardian before it runs. Nothing
        unknown is ever allowed.
      </p>

      <div className="mt-4 space-y-2">
        {loading && (
          <p className="py-4 text-center text-xs text-charcoal-muted">
            Loading decisions…
          </p>
        )}

        {error && !loading && (
          <p className="py-4 text-center text-xs text-red-600">{error}</p>
        )}

        {!loading && !error && decisions.length === 0 && (
          <p className="py-4 text-center text-xs text-charcoal-muted">
            No guarded actions yet.
          </p>
        )}

        {decisions.map((decision) => {
          const DecisionIcon =
            DECISION_ICONS[decision.decision] ?? ShieldCheck;
          return (
            <div
              key={decision.id}
              className="flex items-start gap-2.5 rounded-lg border border-charcoal/5 px-3 py-2"
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${DECISION_COLORS[decision.decision]}`}
              >
                <DecisionIcon className="h-3 w-3" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-xs font-medium text-charcoal">
                    {decision.agent_name}
                  </span>
                  {decision.tool_name && (
                    <span className="truncate text-[11px] text-charcoal-muted">
                      → {decision.tool_name}
                    </span>
                  )}
                  <span
                    className={`ml-auto shrink-0 text-[11px] font-medium ${EXECUTION_COLORS[decision.execution_status]}`}
                  >
                    {decision.execution_status}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-[11px] text-charcoal-muted">
                  {decision.decision} · {decision.risk} risk ·{" "}
                  {decision.action_type}
                </p>
                {decision.reason && (
                  <p className="mt-0.5 line-clamp-2 text-[10px] text-charcoal-muted/70">
                    {decision.reason}
                  </p>
                )}
                <div className="mt-0.5 flex items-center gap-2 text-[10px] text-charcoal-muted/70">
                  <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                  {timeAgo(decision.created_at)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
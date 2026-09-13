"use client";

import { useEffect, useState } from "react";
import { Shield, AlertTriangle, CheckCircle, XCircle } from "lucide-react";

type AuditLog = {
  id: string;
  agent_name: string;
  tool_name: string | null;
  action_type: string;
  risk: "low" | "medium" | "high";
  status: "granted" | "denied" | "error";
  entity_type: string | null;
  entity_id: string | null;
  detail: Record<string, unknown>;
  created_at: string;
};

const RISK_ICONS: Record<string, typeof Shield> = {
  low: CheckCircle,
  medium: AlertTriangle,
  high: XCircle,
};

const RISK_COLORS: Record<string, string> = {
  low: "text-green-600 bg-green-50",
  medium: "text-amber-600 bg-amber-50",
  high: "text-red-600 bg-red-50",
};

const STATUS_COLORS: Record<string, string> = {
  granted: "text-green-700",
  denied: "text-red-600",
  error: "text-amber-600",
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

export function AiAuditLogViewer() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/ai/audit-logs?limit=20");
        if (!res.ok) {
          if (!cancelled) setError("Failed to load audit logs.");
          return;
        }
        const data = await res.json();
        if (!cancelled) setLogs(data.logs ?? []);
      } catch {
        if (!cancelled) setError("Could not load audit logs.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="rounded-2xl border border-charcoal/10 bg-white p-5">
      <h2 className="font-serif text-base text-charcoal">AI Audit Trail</h2>
      <p className="mt-1 text-xs text-charcoal-muted">
        Recent AI actions — every tool call is authorized and logged.
      </p>

      <div className="mt-4 space-y-2">
        {loading && (
          <p className="py-4 text-center text-xs text-charcoal-muted">
            Loading audit logs…
          </p>
        )}

        {error && !loading && (
          <p className="py-4 text-center text-xs text-red-600">{error}</p>
        )}

        {!loading && !error && logs.length === 0 && (
          <p className="py-4 text-center text-xs text-charcoal-muted">
            No AI activity yet.
          </p>
        )}

        {logs.map((log) => {
          const RiskIcon = RISK_ICONS[log.risk] ?? Shield;
          return (
            <div
              key={log.id}
              className="flex items-start gap-2.5 rounded-lg border border-charcoal/5 px-3 py-2"
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${RISK_COLORS[log.risk]}`}
              >
                <RiskIcon className="h-3 w-3" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-xs font-medium text-charcoal">
                    {log.agent_name}
                  </span>
                  {log.tool_name && (
                    <span className="truncate text-[11px] text-charcoal-muted">
                      → {log.tool_name}
                    </span>
                  )}
                  <span
                    className={`ml-auto shrink-0 text-[11px] font-medium ${STATUS_COLORS[log.status]}`}
                  >
                    {log.status}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-[11px] text-charcoal-muted">
                  {log.action_type}
                  {log.entity_type ? ` · ${log.entity_type}` : ""}
                </p>
                <p className="mt-0.5 text-[10px] text-charcoal-muted/70">
                  {timeAgo(log.created_at)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

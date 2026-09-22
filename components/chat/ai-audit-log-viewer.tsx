"use client";

import { useEffect, useState } from "react";

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

const STATUS_BADGES: Record<string, string> = {
  granted: "bg-green-100 text-green-700",
  denied: "bg-red-100 text-red-600",
  error: "bg-amber-100 text-amber-700",
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

  if (loading) {
    return (
      <p className="px-4 py-10 text-center text-xs text-charcoal-muted">
        Loading audit logs…
      </p>
    );
  }

  if (error) {
    return <p className="px-4 py-10 text-center text-xs text-red-600">{error}</p>;
  }

  if (logs.length === 0) {
    return (
      <p className="px-4 py-10 text-center text-xs text-charcoal-muted">
        No AI activity yet.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {logs.map((log) => (
        <li
          key={log.id}
          className="rounded-xl border border-charcoal/10 bg-white p-3 shadow-sm"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-xs text-charcoal">
              <span className="font-semibold">{log.agent_name}</span>
              <span className="mx-1 text-charcoal-muted/50" aria-hidden="true">
                →
              </span>
              <span className="font-medium text-plum">
                {log.tool_name ?? log.action_type}
              </span>
            </p>
            <span
              className={`flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${
                STATUS_BADGES[log.status] ?? "bg-neutral-soft text-charcoal-muted"
              }`}
            >
              {log.status}
            </span>
          </div>

          <p className="mt-1.5 truncate text-[11px] text-charcoal-muted">
            {log.action_type}
            {log.entity_type ? (
              <span className="text-charcoal-muted/60">
                <span className="mx-1" aria-hidden="true">·</span>
                {log.entity_type}
              </span>
            ) : null}
          </p>

          <div className="mt-1.5 flex justify-end">
            <span className="text-[10px] text-charcoal-muted/70">
              {timeAgo(log.created_at)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
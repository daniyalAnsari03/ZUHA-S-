"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import { decideApprovalAction } from "@/app/admin/ai/actions";

export type ApprovalItem = {
  id: string;
  agent_name: string;
  action_type: string;
  risk: "low" | "medium" | "high";
  summary: string;
  target_type: string | null;
  requested_at: string;
};

const RISK_ICONS: Record<string, typeof ShieldCheck> = {
  low: CheckCircle,
  medium: AlertTriangle,
  high: XCircle,
};

const RISK_COLORS: Record<string, string> = {
  low: "text-green-600 bg-green-50",
  medium: "text-amber-600 bg-amber-50",
  high: "text-red-600 bg-red-50",
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

export function PendingApprovalsViewer({
  initial,
}: {
  initial: ApprovalItem[];
}) {
  const [items, setItems] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function decide(id: string, approve: boolean) {
    setBusyId(id);
    setNotice(null);
    const result = await decideApprovalAction(id, approve);
    setBusyId(null);
    if (result.ok) {
      setItems((prev) => prev.filter((item) => item.id !== id));
      setNotice(approve ? "Approved and executed." : "Rejected.");
    } else {
      setNotice(result.error);
    }
  }

  return (
    <div className="rounded-2xl border border-plum/15 bg-plum/5 p-5">
      <div className="flex items-center gap-2">
        <h2 className="font-serif text-base text-charcoal">Pending approvals</h2>
        {items.length > 0 && (
          <span className="rounded-full bg-plum px-2 py-0.5 text-xs font-semibold text-white">
            {items.length}
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-charcoal-muted">
        High-risk AI actions waiting for your decision. Only the exact approved
        operation is executed.
      </p>

      {notice && (
        <p className="mt-3 rounded-lg bg-white px-3 py-2 text-xs font-medium text-plum">
          {notice}
        </p>
      )}

      <div className="mt-4 space-y-2.5">
        {items.length === 0 && (
          <p className="rounded-lg border border-dashed border-plum/20 px-3 py-4 text-center text-xs text-charcoal-muted">
            Nothing waiting for approval.
          </p>
        )}

        {items.map((item) => {
          const RiskIcon = RISK_ICONS[item.risk] ?? ShieldCheck;
          return (
            <div
              key={item.id}
              className="rounded-lg border border-charcoal/10 bg-white p-3"
            >
              <div className="flex items-start gap-2.5">
                <span
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${RISK_COLORS[item.risk]}`}
                >
                  <RiskIcon className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-charcoal">
                    {item.summary}
                  </p>
                  <p className="mt-1 text-[11px] text-charcoal-muted">
                    {item.agent_name} · {item.action_type}
                    {item.target_type ? ` · ${item.target_type}` : ""} ·{" "}
                    {timeAgo(item.requested_at)}
                  </p>
                  <div className="mt-2.5 flex gap-2">
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => void decide(item.id, true)}
                      className="inline-flex items-center gap-1 rounded-full bg-plum px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-plum-dark disabled:opacity-50"
                    >
                      Approve & send
                    </button>
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => void decide(item.id, false)}
                      className="inline-flex items-center gap-1 rounded-full border border-charcoal/20 px-3.5 py-1.5 text-xs font-medium text-charcoal-muted transition-colors hover:border-red-700 hover:text-red-700 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
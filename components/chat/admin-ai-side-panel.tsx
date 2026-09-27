"use client";

import { useState } from "react";
import { History, ShieldCheck } from "lucide-react";

import { AiAuditLogViewer } from "@/components/chat/ai-audit-log-viewer";
import { AiConversationHistory } from "@/components/chat/ai-conversation-history";
import { SlideOver } from "@/components/storefront/slide-over";
import { cn } from "@/lib/utils";

type Tab = "history" | "audit";

type AdminAiSidePanelProps = {
  open: boolean;
  onClose: () => void;
  channel: "admin" | "salesman";
  activeConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
};

/**
 * Collapsible AI Workplace side panel (slide-over drawer) hosting the
 * conversation history and the AI audit trail as tabs. Full-width on mobile,
 * a comfortable drawer column on desktop.
 */
export function AdminAiSidePanel({
  open,
  onClose,
  channel,
  activeConversationId,
  onSelectConversation,
}: AdminAiSidePanelProps) {
  const [tab, setTab] = useState<Tab>("history");

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title="AI Workplace"
      side="right"
      panelClassName="w-full sm:w-[26rem] lg:w-[28rem]"
      labelledById="admin-ai-side-panel-title"
    >
      <div className="flex flex-col gap-3 p-4">
        <div
          role="tablist"
          aria-label="AI Workplace activity"
          className="flex items-center gap-1 rounded-full bg-plum/10 p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === "history"}
            onClick={() => setTab("history")}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium transition-colors",
              tab === "history"
                ? "bg-plum text-white shadow-sm"
                : "text-plum/70 hover:text-plum",
            )}
          >
            <History className="h-3.5 w-3.5" aria-hidden="true" />
            History
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "audit"}
            onClick={() => setTab("audit")}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium transition-colors",
              tab === "audit"
                ? "bg-plum text-white shadow-sm"
                : "text-plum/70 hover:text-plum",
            )}
          >
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Audit Trail
          </button>
        </div>

        <div
          role="tabpanel"
          aria-label="AI Workplace activity"
          className={cn(tab === "history" ? "block" : "hidden")}
        >
          <AiConversationHistory
            channel={channel}
            onSelect={onSelectConversation}
            activeConversationId={activeConversationId}
          />
        </div>
        <div
          role="tabpanel"
          aria-label="AI audit trail"
          className={cn(tab === "audit" ? "block" : "hidden")}
        >
          <AiAuditLogViewer />
        </div>
      </div>
    </SlideOver>
  );
}

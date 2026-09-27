"use client";

import { useCallback, useState } from "react";
import { History } from "lucide-react";

import { AdminAiSidePanel } from "@/components/chat/admin-ai-side-panel";
import { AiChat } from "@/components/chat/ai-chat";

type AdminAiWorkplacePanelProps = {
  initialConversationId: string | null;
};

/**
 * Client wrapper for the admin AI Workplace. The chat panel is the primary
 * focus and takes the full width; conversation history and the AI audit
 * trail live in a collapsible slide-over drawer opened from the chat header.
 */
export function AdminAiWorkplacePanel({
  initialConversationId,
}: AdminAiWorkplacePanelProps) {
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(initialConversationId);
  const [panelOpen, setPanelOpen] = useState(false);

  const handleSelectConversation = useCallback((id: string) => {
    setActiveConversationId(id);
    setPanelOpen(false);
  }, []);

  return (
    <div className="min-w-0">
      <AiChat
        channel="admin"
        storageKey="dins:ai:admin-conversation"
        title="AI Manager"
        subtitle="DINS by Daniyal · business workforce"
        fallbackAgent="AI Manager"
        variant="panel"
        theme="gold"
        conversationToLoad={activeConversationId}
        onReset={() => setActiveConversationId(null)}
        headerActions={
          <button
            type="button"
            onClick={() => setPanelOpen(true)}
            title="Conversations & audit trail"
            aria-label="Open conversations and audit trail"
            className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-white/85 ring-1 ring-white/20 transition hover:bg-white/20"
          >
            <History className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">History</span>
          </button>
        }
        quickPrompts={[
          "Low stock products batao",
          "Aaj ki sales report",
          "Pending orders list karo",
          "Naya product add karo",
        ]}
      />

      <AdminAiSidePanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        channel="admin"
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
      />
    </div>
  );
}

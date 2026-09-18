"use client";

import { useCallback, useState } from "react";

import { AiChat } from "@/components/chat/ai-chat";
import { AiConversationHistory } from "@/components/chat/ai-conversation-history";

type AdminAiWorkplacePanelProps = {
  initialConversationId: string | null;
};

/**
 * Client wrapper for the admin AI Workplace that bundles the AI chat panel
 * with the conversation history browser and audit log viewer sidebar. The
 * conversation history allows switching between past threads.
 */
export function AdminAiWorkplacePanel({
  initialConversationId,
}: AdminAiWorkplacePanelProps) {
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    initialConversationId,
  );

  const handleSelectConversation = useCallback((id: string) => {
    setActiveConversationId(id);
  }, []);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
      <AiChat
        channel="admin"
        storageKey="dins:ai:admin-conversation"
        title="AI Manager"
        subtitle="DINS by Daniyal · business workforce"
        fallbackAgent="AI Manager"
        variant="panel"
        quickPrompts={[
          "Low stock products batao",
          "Aaj ki sales report",
          "Pending orders list karo",
          "Naya product add karo",
        ]}
      />

      <aside className="flex flex-col gap-4">
        <AiConversationHistory
          channel="admin"
          onSelect={handleSelectConversation}
          activeConversationId={activeConversationId}
        />
      </aside>
    </div>
  );
}

"use client";

import { AiChat } from "@/components/chat/ai-chat";

/**
 * Storefront AI Salesman — floating chat trigger that opens a compact,
 * focused chat panel without leaving the current page. The chat color/gradient
 * language is locked (premium plum: dark → gradually lighter → warm white).
 */
export function AiSalesmanWidget() {
  return (
    <AiChat
      channel="salesman"
      storageKey="dins:ai:salesman-conversation"
      title="AI Salesman"
      subtitle="dINS by Daniyal · ask me anything"
      fallbackAgent="AI Salesman"
      variant="floating"
      quickPrompts={[
        "What's new in the collection?",
        "Do you have unstitched lawn?",
        "What is the delivery time?",
        "Can I track my order?",
      ]}
    />
  );
}
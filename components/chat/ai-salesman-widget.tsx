"use client";

import { AiChat } from "@/components/chat/ai-chat";

/**
 * Storefront AI Salesman — floating chat trigger that opens a compact,
 * focused chat panel without leaving the current page. Shares the same
 * premium plum + ivory brand language as the rest of the storefront.
 */
export function AiSalesmanWidget() {
  return (
    <AiChat
      channel="salesman"
      storageKey="dins:ai:salesman-conversation"
      title="AI Salesman"
      fallbackAgent="AI Salesman"
      variant="floating"
      theme="gold"
      quickPrompts={[
        "What's new in the collection?",
        "Do you have unstitched lawn?",
        "What is the delivery time?",
        "Can I track my order?",
      ]}
    />
  );
}
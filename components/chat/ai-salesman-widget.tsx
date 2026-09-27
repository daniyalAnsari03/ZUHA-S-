"use client";

import dynamic from "next/dynamic";
import { MessageCircle } from "lucide-react";
import { useState } from "react";

import { ChatNotificationBadge } from "@/components/notifications/chat-notification-badge";
import { WidgetErrorBoundary } from "@/components/ui/widget-error-boundary";

/**
 * Storefront AI Salesman — floating chat trigger that opens a compact,
 * focused chat panel without leaving the current page. Shares the same
 * premium plum + ivory brand language as the rest of the storefront.
 *
 * The conversation UI is the largest piece of storefront client code and pulls
 * in the JS animation runtime, so it is only fetched once the customer
 * actually asks for it. Until then this component renders a visually identical
 * trigger (same gradient, ring, shadow and entrance animation, driven purely by
 * CSS) plus the notification bell, and the first click swaps in the real chat
 * with its panel already open. Previously the module was `dynamic()` but
 * rendered immediately, so it was still fetched and parsed right after
 * hydration on every single storefront page while its panel stayed invisible.
 */
const AiChat = dynamic(
  () => import("@/components/chat/ai-chat").then((m) => m.AiChat),
  {
    ssr: false,
    loading: () => null,
  },
);

const QUICK_PROMPTS = [
  "What's new in the collection?",
  "Do you have unstitched lawn?",
  "What is the delivery time?",
  "Can I track my order?",
];

export function AiSalesmanWidget() {
  const [activate, setActivate] = useState(false);

  if (activate) {
    return (
      <AiChat
        channel="salesman"
        storageKey="dins:ai:salesman-conversation"
        title="AI Salesman"
        fallbackAgent="AI Salesman"
        variant="floating"
        theme="gold"
        initialOpen
        quickPrompts={QUICK_PROMPTS}
      />
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-[60]">
      <WidgetErrorBoundary fallback={null}>
        <ChatNotificationBadge />
      </WidgetErrorBoundary>
      <button
        type="button"
        onClick={() => setActivate(true)}
        className="chat-trigger-enter relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-plum-dark via-plum to-plum-light text-white shadow-xl shadow-plum/30 ring-1 ring-plum-light/40"
        aria-label="Open AI Salesman"
      >
        <MessageCircle className="h-6 w-6" aria-hidden="true" />
      </button>
    </div>
  );
}

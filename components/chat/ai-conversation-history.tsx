"use client";

import { useEffect, useState } from "react";
import { Clock, MessageCircle } from "lucide-react";

type Conversation = {
  id: string;
  updatedAt: string;
  preview?: string;
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

function previewLabel(conversation: Conversation): string {
  const text = (conversation.preview ?? "")
    .replace(/\[Attached image:[^\]]+\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text || `Conversation ${conversation.id.slice(0, 8)}`;
}

type AiConversationHistoryProps = {
  channel: "admin" | "salesman";
  onSelect: (conversationId: string) => void;
  activeConversationId: string | null;
};

export function AiConversationHistory({
  channel,
  onSelect,
  activeConversationId,
}: AiConversationHistoryProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/ai/conversations?channel=${channel}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setConversations(data.conversations ?? []);
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [channel]);

  if (loading) {
    return (
      <p className="px-4 py-10 text-center text-xs text-charcoal-muted">
        Loading conversations…
      </p>
    );
  }

  if (conversations.length === 0) {
    return (
      <p className="px-4 py-10 text-center text-xs text-charcoal-muted">
        No conversations yet.
      </p>
    );
  }

  return (
    <ul className="space-y-1.5">
      {conversations.map((conv) => {
        const isActive = conv.id === activeConversationId;
        return (
          <li key={conv.id}>
            <button
              type="button"
              onClick={() => onSelect(conv.id)}
              aria-current={isActive ? "true" : undefined}
              className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                isActive
                  ? "border-plum/25 bg-plum/10"
                  : "border-transparent hover:border-plum/15 hover:bg-cream"
              }`}
            >
              <MessageCircle
                className="h-3.5 w-3.5 shrink-0 text-plum"
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1">
                <span
                  className={`block truncate text-xs font-medium ${
                    isActive ? "text-plum" : "text-charcoal"
                  }`}
                >
                  {previewLabel(conv)}
                </span>
                <span className="mt-0.5 flex items-center gap-1 text-[10px] text-charcoal-muted/70">
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  {timeAgo(conv.updatedAt)}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
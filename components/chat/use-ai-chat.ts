"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type AiStreamEvent =
  | { type: "meta"; conversationId: string | null }
  | { type: "start" }
  | { type: "agent"; name: string }
  | { type: "tool"; name: string; state: "start" | "end" }
  | { type: "text"; delta: string }
  | { type: "done"; output: string }
  | { type: "error"; message: string };

function newId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useAiChat(
  channel: "admin" | "salesman",
  storageKey: string,
) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [activeTools, setActiveTools] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored) setConversationId(stored);
    } catch {
      // private mode / storage disabled → conversations behave as guest threads
    }
  }, [storageKey]);

  const persistConversationId = useCallback(
    (id: string | null) => {
      setConversationId(id);
      try {
        if (id) {
          window.localStorage.setItem(storageKey, id);
        } else {
          window.localStorage.removeItem(storageKey);
        }
      } catch {
        // ignore storage failures
      }
    },
    [storageKey],
  );

  const finalizeLastMessage = useCallback(
    (content: string | null) => {
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.role === "assistant") {
          last.content = content ?? last.content;
        }
        return next;
      });
    },
    [],
  );

  const send = useCallback(async () => {
    const body = input.trim();
    if (!body || busyRef.current) return;

    const imageMarker = attachedImage
      ? `\n\n[Attached image: ${attachedImage}]`
      : "";
    const content = body + imageMarker;

    const currentId = conversationId;
    const history = messages.slice(-12).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    setInput("");
    setAttachedImage(null);
    setError(null);
    setActiveAgent(channel === "admin" ? "manager" : "salesman");
    setActiveTools([]);
    setIsBusy(true);
    busyRef.current = true;

    const userMessage: ChatMessage = { id: newId(), role: "user", content };
    const assistantMessage: ChatMessage = { id: newId(), role: "assistant", content: "" };
    setMessages((prev) => [...prev, userMessage, assistantMessage]);

    try {
      const res = await fetch(`/api/ai/${channel}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: content, conversationId: currentId, history }),
      });

      if (!res.ok) {
        let message = "Could not reach the assistant.";
        try {
          const dataText = await res.text();
          const data = dataText ? JSON.parse(dataText) : null;
          if (typeof data?.error === "string") message = data.error;
        } catch {
          // fall through with the default message
        }
        setError(message);
        finalizeLastMessage(message);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setError("Streaming is not supported in this browser.");
        finalizeLastMessage("Could not start a response in this browser.");
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      const handleEvent = (event: AiStreamEvent) => {
        switch (event.type) {
          case "meta":
            persistConversationId(event.conversationId);
            break;
          case "start":
            break;
          case "agent":
            setActiveAgent(event.name);
            break;
          case "tool":
            if (event.state === "start") {
              setActiveTools((prev) =>
                prev.includes(event.name) ? prev : [...prev, event.name],
              );
            } else {
              setActiveTools((prev) =>
                prev.filter((tool) => tool !== event.name),
              );
            }
            break;
          case "text":
            accumulated += event.delta;
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last && last.role === "assistant") {
                last.content = accumulated;
              }
              return next;
            });
            break;
          case "done":
            if (event.output) {
              finalizeLastMessage(event.output);
            } else {
              finalizeLastMessage(null);
            }
            break;
          case "error":
            setError(event.message);
            finalizeLastMessage(event.message);
            break;
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            handleEvent(JSON.parse(trimmed) as AiStreamEvent);
          } catch {
            // ignore malformed line (defensive)
          }
        }
      }
    } catch {
      setError("Could not reach the assistant. Please try again.");
      finalizeLastMessage("I couldn't connect. Please try again.");
    } finally {
      setIsBusy(false);
      busyRef.current = false;
      setActiveTools([]);
    }
  }, [
    channel,
    conversationId,
    messages,
    input,
    attachedImage,
    persistConversationId,
    finalizeLastMessage,
  ]);

  const loadConversation = useCallback(
    async (id: string) => {
      persistConversationId(id);
      setMessages([]);
      setIsBusy(false);
      busyRef.current = false;
      setActiveAgent(null);
      setActiveTools([]);
      setError(null);
      setAttachedImage(null);

      try {
        const res = await fetch(`/api/ai/conversations/${id}/messages`);
        if (!res.ok) return;
        const data = await res.json();
        const loaded: ChatMessage[] = (data.messages ?? []).map(
          (m: { id: string; role: string; content: string }) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
          }),
        );
        setMessages(loaded);
      } catch {
        // silent — conversation starts empty
      }
    },
    [persistConversationId],
  );

  const reset = useCallback(() => {
    setMessages([]);
    setIsBusy(false);
    busyRef.current = false;
    setActiveAgent(null);
    setActiveTools([]);
    setError(null);
    setAttachedImage(null);
    persistConversationId(null);
  }, [persistConversationId]);

  function submit(event?: { preventDefault: () => void }) {
    event?.preventDefault();
    if (!isBusy) void send();
  }

  return {
    messages,
    input,
    setInput,
    send: submit,
    isBusy,
    activeAgent,
    activeTools,
    error,
    setError,
    reset,
    loadConversation,
    conversationId,
    attachedImage,
    setAttachedImage,
  };
}
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ProductReference = {
  id: string;
  name: string;
  slug: string;
  price: string;
  imageUrl: string | null;
  fabric: string | null;
  category: string | null;
  availability?: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  products?: ProductReference[];
};

type AiStreamEvent =
  | { type: "meta"; conversationId: string | null }
  | { type: "start" }
  | { type: "agent"; name: string }
  | { type: "tool"; name: string; state: "start" | "end" }
  | { type: "text"; delta: string }
  | { type: "products"; products: ProductReference[] }
  | { type: "done"; output: string }
  | { type: "error"; message: string };

/**
 * Per-word reveal delay. The chat intentionally types the AI reply out word by
 * word so long reports stay readable instead of snapping in at full burst
 * speed. Keep this clearly named and exported so the reveal pace is a single,
 * obvious constant.
 */
export const REVEAL_WORD_MS = 85;

/**
 * Split an incoming streaming text delta into reveal tokens that, when
 * concatenated in order, reproduce the ORIGINAL text with exactly the same
 * spacing — never more, never less.
 *
 * Splitting on a per-chunk regex of "non-whitespace run + optional trailing
 * space" drops leading whitespace when a chunk starts with a space/newline
 * (e.g. a word split across chunks followed by a space-boundary) and drops
 * pure-whitespace chunks entirely, which is what made streamed words render
 * concatenated ("foxjumps") until the final text snapped in. Here whitespace
 * is always re-attached in front of the following word (or appended to the
 * trailing token when the chunk ends in whitespace), so every original
 * space/newline survives in the exact right position no matter how the
 * network splits the response.
 */
export function splitRevealTokens(delta: string): string[] {
  if (!delta) return [];
  const parts = delta.split(/(\s+)/);
  const tokens: string[] = [];
  let whitespace = "";
  for (const part of parts) {
    if (!part) continue;
    if (/^\s+$/.test(part)) {
      whitespace += part;
      continue;
    }
    tokens.push(whitespace + part);
    whitespace = "";
  }
  if (whitespace) {
    if (tokens.length > 0) tokens[tokens.length - 1] += whitespace;
    else tokens.push(whitespace);
  }
  return tokens;
}

function newId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useAiChat(channel: "admin" | "salesman", storageKey: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [activeTools, setActiveTools] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const busyRef = useRef(false);
  const wordQueueRef = useRef<string[]>([]);
  const displayedTextRef = useRef("");
  const productsRef = useRef<ProductReference[]>([]);
  const finalizePendingRef = useRef<{ content: string | null } | null>(null);

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

  const finalizeLastMessage = useCallback((content: string | null) => {
    setMessages((prev) => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (last && last.role === "assistant") {
        last.content = content ?? last.content;
        last.products = [...productsRef.current];
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      const item = wordQueueRef.current.shift();
      if (item !== undefined) {
        displayedTextRef.current += item;
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.role === "assistant") {
            last.content = displayedTextRef.current;
          }
          return next;
        });
        return;
      }
      const pending = finalizePendingRef.current;
      if (pending) {
        finalizePendingRef.current = null;
        finalizeLastMessage(pending.content);
      }
    }, REVEAL_WORD_MS);
    return () => window.clearInterval(id);
  }, [finalizeLastMessage]);

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
    wordQueueRef.current = [];
    displayedTextRef.current = "";
    productsRef.current = [];
    finalizePendingRef.current = null;

    const userMessage: ChatMessage = { id: newId(), role: "user", content };
    const assistantMessage: ChatMessage = {
      id: newId(),
      role: "assistant",
      content: "",
      products: [],
    };
    setMessages((prev) => [...prev, userMessage, assistantMessage]);

    try {
      const res = await fetch(`/api/ai/${channel}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: content,
          conversationId: currentId,
          history,
        }),
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
            wordQueueRef.current.push(...splitRevealTokens(event.delta));
            break;
          case "products":
            for (const product of event.products) {
              if (
                product.id &&
                !productsRef.current.some((existing) => existing.id === product.id)
              ) {
                productsRef.current.push(product);
              }
            }
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last && last.role === "assistant") {
                last.products = [...productsRef.current];
              }
              return next;
            });
            break;
          case "done":
            finalizePendingRef.current = { content: event.output ?? null };
            break;
          case "error":
            setError(event.message);
            wordQueueRef.current = [];
            finalizePendingRef.current = { content: event.message };
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
      wordQueueRef.current = [];
      finalizePendingRef.current = {
        content: "I couldn't connect. Please try again.",
      };
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
      wordQueueRef.current = [];
      displayedTextRef.current = "";
      productsRef.current = [];
      finalizePendingRef.current = null;

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
    wordQueueRef.current = [];
    displayedTextRef.current = "";
    productsRef.current = [];
    finalizePendingRef.current = null;
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

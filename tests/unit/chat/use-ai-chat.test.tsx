import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  REVEAL_WORD_MS,
  splitRevealTokens,
  useAiChat,
  type ChatMessage,
  type ProductReference,
} from "@/components/chat/use-ai-chat";

type StreamEvent =
  | { type: "meta"; conversationId: string | null }
  | { type: "start" }
  | { type: "agent"; name: string }
  | { type: "tool"; name: string; state: "start" | "end" }
  | { type: "text"; delta: string }
  | { type: "products"; products: ProductReference[] }
  | { type: "done"; output: string }
  | { type: "error"; message: string };

function streamBody(events: StreamEvent[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const payload =
    events.map((event) => JSON.stringify(event)).join("\n") + "\n";
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(payload));
      controller.close();
    },
  });
}

function stubStream(events: StreamEvent[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      body: streamBody(events),
    })),
  );
}

function lastAssistant(result: {
  current: { messages: ChatMessage[] };
}): ChatMessage | undefined {
  const messages = result.current.messages;
  return messages.length === 0 ? undefined : messages[messages.length - 1];
}

describe("splitRevealTokens", () => {
  it("preserves exact spacing within one chunk", () => {
    expect(splitRevealTokens("Hello world! This is a test.").join("")).toBe(
      "Hello world! This is a test.",
    );
  });

  it("keeps trailing whitespace attached to the preceding word", () => {
    expect(splitRevealTokens("Hello ").join("")).toBe("Hello ");
    expect(splitRevealTokens("line one\n\nline two").join("")).toBe(
      "line one\n\nline two",
    );
  });

  it("does not drop whitespace that opens a later chunk (the concat bug)", () => {
    // Word split across chunks + a chunk that starts with a space used to lose
    // that space, rendering "...bro" + "wn fox" + " jumps" with the final
    // space dropped: "jumps" concatenated onto "fox".
    const tokens = [
      ...splitRevealTokens("The quick bro"),
      ...splitRevealTokens("wn fox"),
      ...splitRevealTokens(" jumps"),
    ];
    expect(tokens.join("")).toBe("The quick brown fox jumps");
  });

  it("never adds or removes characters across arbitrary chunkings", () => {
    const full = "Your total is Rs 4,750. Please confirm.";
    const chunkings = [
      ["Your ", "total is R", "s 4,750. P", "lease confirm."],
      ["Your total is Rs ", "", "4,750. ", "Please confirm."],
      [full],
    ];
    for (const chunks of chunkings) {
      const joined = chunks
        .flatMap((chunk) => splitRevealTokens(chunk))
        .join("");
      expect(joined).toBe(full);
    }
  });
});

describe("useAiChat reveal queue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("decouples network burst speed from display speed and drains word by word", async () => {
    const output = "Hello world! This is a test.";
    stubStream([
      { type: "start" },
      { type: "agent", name: "manager" },
      { type: "text", delta: "Hello " },
      { type: "text", delta: "world! This " },
      { type: "text", delta: "is a test." },
      { type: "done", output },
    ]);

    const { result } = renderHook(() => useAiChat("admin", "reveal-test-key"));

    act(() => result.current.setInput("hi"));

    await act(async () => {
      result.current.send();
    });

    expect(lastAssistant(result)?.content).toBe("");

    act(() => vi.advanceTimersByTime(REVEAL_WORD_MS));
    expect(lastAssistant(result)?.content).toBe("Hello ");

    act(() => vi.advanceTimersByTime(REVEAL_WORD_MS));
    expect(lastAssistant(result)?.content).toBe("Hello world!");

    act(() => vi.advanceTimersByTime(REVEAL_WORD_MS));
    expect(lastAssistant(result)?.content).toBe("Hello world! This ");

    act(() => vi.advanceTimersByTime(REVEAL_WORD_MS * 3));
    expect(lastAssistant(result)?.content).toBe("Hello world! This is a test.");

    act(() => vi.advanceTimersByTime(REVEAL_WORD_MS));
    expect(lastAssistant(result)?.content).toBe(output);
  });

  it("keeps exact spacing even when the network splits words and whitespace", async () => {
    const output = "The quick brown fox jumps";
    stubStream([
      { type: "start" },
      { type: "text", delta: "The quick bro" },
      { type: "text", delta: "wn fox" },
      { type: "text", delta: " jumps" },
      { type: "done", output },
    ]);

    const { result } = renderHook(() =>
      useAiChat("admin", "reveal-spacing-test-key"),
    );

    act(() => result.current.setInput("hi"));

    await act(async () => {
      result.current.send();
    });

    // Never concatenated mid-reveal: each step is an exact prefix of the final
    // text with correct spaces, and the final text matches word for word.
    const steps: string[] = [];
    for (let i = 1; i <= 6; i++) {
      act(() => vi.advanceTimersByTime(REVEAL_WORD_MS));
      steps.push(lastAssistant(result)?.content ?? "");
    }

    expect(steps[0]).toBe("The");
    expect(steps[1]).toBe("The quick");
    expect(steps[2]).toBe("The quick bro");
    expect(steps[3]).toBe("The quick brown");
    expect(steps[4]).toBe("The quick brown fox");
    expect(steps[5]).toBe("The quick brown fox jumps");

    act(() => vi.advanceTimersByTime(REVEAL_WORD_MS));
    expect(lastAssistant(result)?.content).toBe(output);
  });

  it("keeps draining buffered words at the same pace until the queue is empty", async () => {
    const output = "Word one two three four.";
    stubStream([
      { type: "start" },
      { type: "text", delta: "Word one " },
      { type: "text", delta: "two three four." },
      { type: "done", output },
    ]);

    const { result } = renderHook(() =>
      useAiChat("admin", "reveal-drain-test-key"),
    );

    act(() => result.current.setInput("hi"));

    await act(async () => {
      result.current.send();
    });

    act(() => vi.advanceTimersByTime(REVEAL_WORD_MS));
    expect(lastAssistant(result)?.content).toBe("Word");

    act(() => vi.advanceTimersByTime(REVEAL_WORD_MS));
    expect(lastAssistant(result)?.content).toBe("Word one ");

    act(() => vi.advanceTimersByTime(REVEAL_WORD_MS * 3));
    expect(lastAssistant(result)?.content).toBe("Word one two three four.");

    act(() => vi.advanceTimersByTime(REVEAL_WORD_MS));
    expect(lastAssistant(result)?.content).toBe(output);
  });

  it("attaches real product cards from products events and keeps them on finalize", async () => {
    const output = "Here are two options from my collection.";
    const products: ProductReference[] = [
      {
        id: "p1",
        name: "Jamawar Kurta",
        slug: "jamawar-kurta",
        price: "PKR 12,500",
        imageUrl: "products/jamawar-kurta.jpeg",
        fabric: "Jamawar",
        category: "Jamawar",
      },
      {
        id: "p2",
        name: "Embroidered Lawn",
        slug: "embroidered-lawn",
        price: "PKR 8,900",
        imageUrl: "products/embroidered-lawn.jpeg",
        fabric: "Lawn",
        category: "Lawn",
      },
      {
        id: "p2",
        name: "Embroidered Lawn (dup)",
        slug: "embroidered-lawn-dup",
        price: "PKR 8,900",
        imageUrl: null,
        fabric: "Lawn",
        category: "Lawn",
      },
    ];
    stubStream([
      { type: "start" },
      { type: "tool", name: "list_products", state: "start" },
      { type: "products", products },
      { type: "tool", name: "list_products", state: "end" },
      { type: "text", delta: "Here are two options " },
      { type: "text", delta: "from my collection." },
      { type: "done", output },
    ]);

    const { result } = renderHook(() =>
      useAiChat("admin", "reveal-products-test-key"),
    );

    act(() => result.current.setInput("hi"));

    await act(async () => {
      result.current.send();
    });

    act(() => vi.advanceTimersByTime(REVEAL_WORD_MS * 4));

    const message = lastAssistant(result);
    // Duplicate id is de-duplicated (first occurrence wins), so the real image
    // URL is kept and the later null-image dup is discarded.
    expect(message?.products?.length).toBe(2);
    expect(message?.products?.[0].imageUrl).toBe("products/jamawar-kurta.jpeg");
    expect(message?.products?.[1].imageUrl).toBe(
      "products/embroidered-lawn.jpeg",
    );

    act(() => vi.advanceTimersByTime(REVEAL_WORD_MS * 4));
    expect(lastAssistant(result)?.content).toBe(output);
    expect(lastAssistant(result)?.products?.length).toBe(2);
  });

  it("on error clears the queue, finalizes with the error text and keeps products inert", async () => {
    stubStream([
      { type: "start" },
      { type: "text", delta: "partial response " },
      { type: "text", delta: "that should not linger" },
      { type: "error", message: "Tool failed mid-turn." },
    ]);

    const { result } = renderHook(() =>
      useAiChat("admin", "reveal-error-test-key"),
    );

    act(() => result.current.setInput("hi"));

    await act(async () => {
      result.current.send();
    });

    expect(result.current.error).toBe("Tool failed mid-turn.");

    act(() => vi.advanceTimersByTime(REVEAL_WORD_MS));
    expect(lastAssistant(result)?.content).toBe("Tool failed mid-turn.");

    act(() => vi.advanceTimersByTime(REVEAL_WORD_MS * 4));
    expect(lastAssistant(result)?.content).toBe("Tool failed mid-turn.");
  });
});
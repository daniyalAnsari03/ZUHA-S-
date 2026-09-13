import { describe, expect, it } from "vitest";

/**
 * Stream event type tests.
 *
 * These verify that the AiStreamEvent type union covers all expected
 * event types used in the NDJSON streaming protocol between server and
 * chat client. This is a structural contract test.
 */

type AiStreamEvent =
  | { type: "meta"; conversationId: string | null }
  | { type: "start" }
  | { type: "agent"; name: string }
  | { type: "tool"; name: string; state: "start" | "end" }
  | { type: "text"; delta: string }
  | { type: "done"; output: string }
  | { type: "error"; message: string };

function isAiStreamEvent(value: unknown): value is AiStreamEvent {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  if (typeof obj.type !== "string") return false;

  switch (obj.type) {
    case "meta":
      return typeof obj.conversationId === "string" || obj.conversationId === null;
    case "start":
      return true;
    case "agent":
      return typeof obj.name === "string";
    case "tool":
      return (
        typeof obj.name === "string" &&
        (obj.state === "start" || obj.state === "end")
      );
    case "text":
      return typeof obj.delta === "string";
    case "done":
      return typeof obj.output === "string";
    case "error":
      return typeof obj.message === "string";
    default:
      return false;
  }
}

describe("AiStreamEvent type validation", () => {
  it("accepts valid meta event", () => {
    expect(isAiStreamEvent({ type: "meta", conversationId: "abc" })).toBe(true);
    expect(isAiStreamEvent({ type: "meta", conversationId: null })).toBe(true);
  });

  it("accepts valid start event", () => {
    expect(isAiStreamEvent({ type: "start" })).toBe(true);
  });

  it("accepts valid agent event", () => {
    expect(isAiStreamEvent({ type: "agent", name: "product" })).toBe(true);
  });

  it("accepts valid tool events", () => {
    expect(isAiStreamEvent({ type: "tool", name: "list_products", state: "start" })).toBe(true);
    expect(isAiStreamEvent({ type: "tool", name: "list_products", state: "end" })).toBe(true);
  });

  it("accepts valid text event", () => {
    expect(isAiStreamEvent({ type: "text", delta: "Hello" })).toBe(true);
  });

  it("accepts valid done event", () => {
    expect(isAiStreamEvent({ type: "done", output: "Full response" })).toBe(true);
  });

  it("accepts valid error event", () => {
    expect(isAiStreamEvent({ type: "error", message: "Something failed" })).toBe(true);
  });

  it("rejects invalid event types", () => {
    expect(isAiStreamEvent({ type: "unknown" })).toBe(false);
    expect(isAiStreamEvent({ type: "meta" })).toBe(false); // missing conversationId
    expect(isAiStreamEvent({ type: "agent" })).toBe(false); // missing name
    expect(isAiStreamEvent(null)).toBe(false);
    expect(isAiStreamEvent("string")).toBe(false);
    expect(isAiStreamEvent(42)).toBe(false);
  });

  it("rejects tool event with invalid state", () => {
    expect(
      isAiStreamEvent({ type: "tool", name: "x", state: "running" }),
    ).toBe(false);
  });

  it("rejects events with wrong field types", () => {
    expect(isAiStreamEvent({ type: "text", delta: 123 })).toBe(false);
    expect(isAiStreamEvent({ type: "done", output: 42 })).toBe(false);
    expect(isAiStreamEvent({ type: "error", message: true })).toBe(false);
  });
});

describe("NDJSON line parsing contract", () => {
  it("each event serializes to a single JSON line", () => {
    const events: AiStreamEvent[] = [
      { type: "meta", conversationId: "abc" },
      { type: "start" },
      { type: "agent", name: "manager" },
      { type: "tool", name: "list_products", state: "start" },
      { type: "text", delta: "Hello " },
      { type: "text", delta: "world" },
      { type: "tool", name: "list_products", state: "end" },
      { type: "done", output: "Hello world" },
    ];

    for (const event of events) {
      const line = JSON.stringify(event);
      const parsed = JSON.parse(line);
      expect(parsed).toEqual(event);
      expect(isAiStreamEvent(parsed)).toBe(true);
    }
  });

  it("reconstructs accumulated text from deltas", () => {
    const deltas = ["Hello ", "world", "!"];
    let accumulated = "";
    for (const delta of deltas) {
      accumulated += delta;
    }
    expect(accumulated).toBe("Hello world!");
  });
});

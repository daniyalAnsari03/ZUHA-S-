import { describe, expect, it } from "vitest";

import { extractTextDelta } from "@/lib/ai/stream";

/**
 * Streaming delta extraction tests.
 *
 * The Responses API (openai ^7) streams text tokens as raw model events with
 * `type: "response.output_text.delta"` and the token under `delta`. The
 * adapter must accept this shape (plus legacy variants) so the chat UI can
 * render text progressively instead of waiting for the full response.
 */
describe("extractTextDelta", () => {
  it("extracts text from response.output_text.delta (openai ^7)", () => {
    expect(
      extractTextDelta({ type: "response.output_text.delta", delta: "Hello " }),
    ).toBe("Hello ");
  });

  it("extracts text from the legacy output_text_delta shape", () => {
    expect(extractTextDelta({ type: "output_text_delta", delta: "world" })).toBe(
      "world",
    );
  });

  it("extracts text from the output_text.delta shape", () => {
    expect(extractTextDelta({ type: "output_text.delta", delta: "!" })).toBe(
      "!",
    );
  });

  it("returns undefined when delta is not a string", () => {
    expect(extractTextDelta({ type: "response.output_text.delta", delta: 42 })).toBeUndefined();
    expect(extractTextDelta({ type: "response.output_text.delta" })).toBeUndefined();
  });

  it("ignores non-text raw events", () => {
    expect(extractTextDelta({ type: "response.reasoning_summary_part.added" })).toBeUndefined();
    expect(extractTextDelta({ type: "response.file_search_call.in_progress" })).toBeUndefined();
    expect(extractTextDelta(null)).toBeUndefined();
    expect(extractTextDelta("text")).toBeUndefined();
    expect(extractTextDelta(42)).toBeUndefined();
  });
});
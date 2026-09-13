import {
  type Agent,
  type RunStreamEvent,
  type StreamedRunResult,
  type RunItem,
} from "@openai/agents";

import type { AgentContext } from "@/agents/context";

/** Events emitted over the NDJSON stream to the chat client. */
export type AiStreamEvent =
  | { type: "meta"; conversationId: string | null }
  | { type: "start" }
  | { type: "agent"; name: string }
  | { type: "tool"; name: string; state: "start" | "end" }
  | { type: "text"; delta: string }
  | { type: "done"; output: string }
  | { type: "error"; message: string };

/**
 * Extract the text delta from a raw Responses API stream event.
 *
 * The OpenAI Responses API (openai ^7) emits text tokens as raw events with
 * `type: "response.output_text.delta"` and the token under `delta`. Older
 * shapes (`output_text_delta` / `output_text.delta`) are also accepted so the
 * adapter keeps working across provider versions.
 */
export function extractTextDelta(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const candidate = data as { type?: unknown; delta?: unknown };
  if (typeof candidate.type !== "string") return undefined;
  if (
    candidate.type === "response.output_text.delta" ||
    candidate.type === "output_text_delta" ||
    candidate.type === "output_text.delta"
  ) {
    return typeof candidate.delta === "string" ? candidate.delta : undefined;
  }
  return undefined;
}

function readToolNameFromItem(item: RunItem): string | undefined {
  // RunToolCallItem and RunToolCallOutputItem both expose rawItem with a
  // name field for function and computer tools.  Safe access handles the
  // union safely without narrowing each variant.
  const raw = (item as { rawItem?: { name?: unknown } }).rawItem;
  return typeof raw?.name === "string" ? raw.name : undefined;
}

function readHandoffTarget(item: RunItem): string | undefined {
  // RunHandoffOutputItem has a targetAgent property.
  const target = (item as { targetAgent?: { name?: unknown } }).targetAgent;
  return typeof target?.name === "string" ? target.name : undefined;
}

/**
 * Translates the SDK's streamed run into a small, client-safe event sequence.
 *
 * - text deltas   → raw_model_stream_event where data.type is
 *                   "response.output_text.delta" (openai ^7 Responses API)
 * - tool activity → run_item_stream_event names "tool_called" / "tool_output"
 * - agent switches → agent_updated_stream_event
 * - final text     → emitted once in the trailing "done" event
 */
export async function* streamRunToEvents(
  result: StreamedRunResult<AgentContext, Agent<AgentContext, any>>,
): AsyncGenerator<AiStreamEvent> {
  let text = "";

  yield { type: "start" };

  try {
    for await (const event of result as AsyncIterable<RunStreamEvent>) {
      if (event.type === "raw_model_stream_event") {
        const delta = extractTextDelta(event.data);
        if (typeof delta === "string" && delta) {
          text += delta;
          yield { type: "text", delta };
        }
      } else if (event.type === "run_item_stream_event") {
        if (event.name === "tool_called") {
          const name = readToolNameFromItem(event.item);
          if (name) yield { type: "tool", name, state: "start" };
        } else if (event.name === "tool_output") {
          const name = readToolNameFromItem(event.item);
          if (name) yield { type: "tool", name, state: "end" };
        } else if (event.name === "handoff_occurred") {
          const target = readHandoffTarget(event.item);
          if (target) {
            yield { type: "agent", name: target };
          }
        }
      } else if (event.type === "agent_updated_stream_event") {
        if (event.agent?.name) {
          yield { type: "agent", name: event.agent.name };
        }
      }
    }
  } finally {
    let finalOutput = text;
    try {
      const output = result.finalOutput;
      if (typeof output === "string" && output.trim()) {
        finalOutput = output;
      }
    } catch {
      // finalOutput only becomes available once the stream has ended.
    }
    yield { type: "done", output: finalOutput };
  }
}

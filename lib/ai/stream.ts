import {
  type Agent,
  type RunStreamEvent,
  type StreamedRunResult,
  type RunItem,
} from "@openai/agents";

import type { AgentContext } from "@/agents/context";

/**
 * Minimal, client-safe product data used to render a real product card in the
 * chat UI. Every field comes straight from the (DB-backed) tool result — the
 * chat never invents a name, price or image.
 */
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

/** Events emitted over the NDJSON stream to the chat client. */
export type AiStreamEvent =
  | { type: "meta"; conversationId: string | null }
  | { type: "start" }
  | { type: "agent"; name: string }
  | { type: "tool"; name: string; state: "start" | "end" }
  | { type: "text"; delta: string }
  | { type: "products"; products: ProductReference[] }
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

/** Catalog tools whose output rows are product lines (name, price, imageUrl…). */
const PRODUCT_CATALOG_TOOLS = new Set(["list_products", "get_product"]);

function readProductReference(row: unknown): ProductReference | null {
  if (!row || typeof row !== "object") return null;
  const entry = row as Record<string, unknown>;
  const name = typeof entry.name === "string" ? entry.name : "";
  const slug = typeof entry.slug === "string" ? entry.slug : "";
  const id = typeof entry.id === "string" ? entry.id : "";
  if (!name && !slug && !id) return null;

  const price =
    typeof entry.price === "string"
      ? entry.price
      : typeof entry.price === "number"
        ? `PKR ${entry.price.toLocaleString("en-PK")}`
        : "";
  const imageUrl =
    typeof entry.imageUrl === "string"
      ? entry.imageUrl
      : typeof entry.image_url === "string"
        ? entry.image_url
        : null;

  return {
    id,
    name,
    slug,
    price,
    imageUrl,
    fabric: typeof entry.fabric === "string" ? entry.fabric : null,
    category: typeof entry.category === "string" ? entry.category : null,
    ...(typeof entry.availability === "string"
      ? { availability: entry.availability }
      : {}),
  };
}

/**
 * Extract real product rows from a catalog tool result so the chat can render
 * product cards instead of making the model describe images in text.
 *
 * Tool outputs are the raw objects returned by the tool's `execute` (e.g.
 * `{ ok: true, data: [...] }`); string outputs are parsed defensively. Only
 * rows that actually carry product identity (name/slug/id) are returned, and
 * only for the catalog tools that return image-bearing product lines.
 */
export function extractProductsFromToolOutput(
  toolName: string,
  output: unknown,
): ProductReference[] {
  if (!PRODUCT_CATALOG_TOOLS.has(toolName)) return [];

  let parsed = output;
  if (typeof output === "string") {
    try {
      parsed = JSON.parse(output);
    } catch {
      return [];
    }
  }
  if (!parsed || typeof parsed !== "object") return [];
  const data = (parsed as Record<string, unknown>).data;
  const rows = Array.isArray(data)
    ? data
    : data && typeof data === "object"
      ? [data]
      : [];

  const refs: ProductReference[] = [];
  for (const row of rows) {
    const ref = readProductReference(row);
    if (ref) refs.push(ref);
  }
  return refs;
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
          const output = (event.item as { output?: unknown }).output;
          const products = extractProductsFromToolOutput(name ?? "", output);
          if (products.length > 0) {
            yield { type: "products", products };
          }
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

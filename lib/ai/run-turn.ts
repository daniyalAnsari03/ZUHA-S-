import {
  InputGuardrailTripwireTriggered,
  MaxTurnsExceededError,
  Runner,
  ToolInputGuardrailTripwireTriggered,
  ToolTimeoutError,
  type Agent,
  type AgentInputItem,
  type StreamedRunResult,
} from "@openai/agents";
import { z } from "zod";

import { getEntryAgent } from "@/agents";
import { AI_MODEL, MAX_AGENT_TURNS } from "@/agents/config";
import type { AgentContext } from "@/agents/context";
import { streamRunToEvents, type AiStreamEvent } from "@/lib/ai/stream";
import {
  buildInputItems,
  conversationOwnedBy,
  createConversation,
  loadMessages,
  saveMessage,
  touchConversation,
  type ChatMessageRow,
} from "@/services/ai/chat-service";
import {
  getPendingDraft,
  setPendingDraft,
  type PendingDraft,
} from "@/services/ai/draft-service";
import {
  resolveAiFocusEntity,
  resolveRecentFocusEntities,
} from "@/services/ai/focus-service";

/**
 * Explicit cancel-intent detection for an active pending draft. When the
 * incoming message clearly abandons the in-progress task ("chhod do", "cancel
 * it", "drop it", "never mind"), the draft is cleared server-side before the
 * turn runs so it can never get stuck. Deliberately narrow: an unrelated
 * question mid-draft ("aaj ki sales?") must NOT match.
 */
const CANCEL_DRAFT_PATTERN =
  /(?:^|\s)(?:chhod\s+do|chhor\s+do|chor\s+do|chord\s+do|chhodh\s+do|cancel\s+kar\s+do|cancel\s+karo|cancel(?:\s+it)?\b|cancel\s+the\s+(?:draft|product|checkout|order)\b|drop\s+it\b|never\s+mind\b|skip\s+it\b)(?=\s|$)/i;

export type ChatUser = {
  id: string;
  email: string | null;
  role: "admin" | "customer";
} | null;

export type ChatTurnOptions = {
  channel: "admin" | "salesman";
  user: ChatUser;
  body: unknown;
};

const chatBodySchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Message is required.")
    .max(4000, "Message is too long (4000 characters max)."),
  conversationId: z.string().uuid().optional().nullable(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      }),
    )
    .max(20)
    .optional(),
});

export type ChatTurnResult =
  | {
      ok: true;
      response: Response;
    }
  | {
      ok: false;
      status: number;
      message: string;
    };

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function ndjson(stream: ReadableStream<Uint8Array>): Response {
  return new Response(stream, {
    status: 200,
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}

function friendlyDriftMessage(kind: string): string {
  switch (kind) {
    case "injection":
      return "I missed part of what you said — something in that message looks like an instruction rather than a request. If it's a business request, please rephrase it directly.";
    case "max_turns":
      return "I stopped because this request needed too many steps. Please rephrase it as one clear instruction and I'll continue from there.";
    case "tool_timeout":
      return "I stopped because an action took too long to complete. Please try again in a moment.";
    default:
      return "Something went wrong while I was thinking. Please try again.";
  }
}

function handleRunError(error: unknown): {
  kind: "injection" | "max_turns" | "tool_timeout" | "error";
  message: string;
} {
  if (error instanceof InputGuardrailTripwireTriggered) {
    const info = error.result?.output?.outputInfo as
      { message?: string } | undefined;
    return {
      kind: "injection",
      message: info?.message ?? friendlyDriftMessage("injection"),
    };
  }
  if (error instanceof ToolInputGuardrailTripwireTriggered) {
    return { kind: "injection", message: friendlyDriftMessage("injection") };
  }
  if (error instanceof MaxTurnsExceededError) {
    return { kind: "max_turns", message: friendlyDriftMessage("max_turns") };
  }
  if (error instanceof ToolTimeoutError) {
    return {
      kind: "tool_timeout",
      message: friendlyDriftMessage("tool_timeout"),
    };
  }
  // Catch Zod validation errors that might leak from tool parameter validation
  const errorStr = String(error);
  if (
    errorStr.includes("Too small:") ||
    errorStr.includes("Too big:") ||
    errorStr.includes("Expected ") ||
    errorStr.includes("Invalid input") ||
    errorStr.includes("zod")
  ) {
    console.error("[ai] tool validation error caught:", error);
    return {
      kind: "error",
      message:
        "I received an invalid input for one of my tools. Please rephrase your request and try again.",
    };
  }
  console.error("[ai] run failed:", error);
  return { kind: "error", message: friendlyDriftMessage("error") };
}

function guardrailDoneEvent(message: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(
        new TextEncoder().encode(
          JSON.stringify({ type: "done", output: message } as AiStreamEvent) +
            "\n",
        ),
      );
      controller.close();
    },
  });
}

/**
 * Executes one chat turn for a channel:
 *
 * 1. validates the body
 * 2. authorizes the channel (admin workplace = admin only, salesman = anyone)
 * 3. persists the message (authenticated users only) and rebuilds history
 * 4. runs the entry agent with the shared context (streamed)
 * 5. streams normalized NDJSON events back to the client
 * 6. persists the assistant reply
 */
export async function runChatTurn(
  options: ChatTurnOptions,
): Promise<ChatTurnResult> {
  const { channel, user } = options;

  if (channel === "admin" && user?.role !== "admin") {
    return {
      ok: false,
      status: 403,
      message: "Admin access required for the AI Workplace.",
    };
  }

  const parsed = chatBodySchema.safeParse(options.body);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Invalid request.";
    return { ok: false, status: 400, message: first };
  }

  const { message, conversationId, history } = parsed.data;

  const isAuthenticated = Boolean(user?.id);

  let conversation: string | null = null;
  let historyRows: ChatMessageRow[] = [];

  try {
    if (isAuthenticated) {
      if (conversationId) {
        const loaded = await loadMessages(conversationId);
        if (loaded.length > 0) {
          conversation = conversationId;
          historyRows = loaded;
        } else {
          // The stored conversation id resolved to zero rows. This is normal
          // when the browser holds a stale/foreign id (old DB, a previous
          // account, or a guest thread). RLS already guarantees we never read
          // someone else's messages, so recover on the user's behalf instead
          // of blocking the turn:
          //   1. Reuse the id when it's genuinely the user's (empty thread).
          //   2. Otherwise start a fresh conversation for the user.
          const owned = await conversationOwnedBy(conversationId, user!.id);
          if (owned) {
            conversation = conversationId;
          } else {
            conversation = await createConversation(user!.id, channel);
          }
        }
      } else {
        conversation = await createConversation(user!.id, channel);
      }
      await saveMessage(conversation, "user", message);
    } else {
      // Guests cannot persist conversations. Ignore any stale stored id — the
      // thread is rebuilt from the bounded client-supplied history instead.
      if (conversationId) {
        console.warn(
          "[ai] guest supplied a stored conversation id; treating as new thread.",
        );
      }
      historyRows = (history ?? []).map((item) => ({
        id: "",
        conversation_id: "",
        role: item.role,
        content: item.content,
        created_at: "",
      }));
    }
  } catch (error) {
    console.error("[ai] persistence failed:", error);
    return {
      ok: false,
      status: 500,
      message: "Could not start the conversation. Please try again.",
    };
  }

  // True only when this is the very first message of a brand-new conversation:
  // an authenticated user whose persisted thread has zero prior rows, or a
  // guest with no client-supplied history. Later turns always have history, so
  // the welcome greeting can never leak onto subsequent messages.
  const isFirstMessage =
    channel === "salesman"
      ? isAuthenticated
        ? historyRows.length === 0
        : (history ?? []).length === 0
      : false;

  const requestId = globalThis.crypto.randomUUID();

  // Resolve the conversation's current focus entity (last named/acted-on
  // product/order/customer) so the next turn can resolve ambiguous references
  // against explicit tracked state. Best-effort: null focus is fine.
  let focusEntity = null;
  let recentFocusEntities = null;
  let pendingDraft: PendingDraft | null = null;
  let draftCancelled = false;
  if (isAuthenticated) {
    try {
      focusEntity = await resolveAiFocusEntity(
        user!.id,
        conversation ?? undefined,
      );
      // Per-type recent entities let follow-ups like "iska order" resolve to
      // an order discussed several turns back even when newer product/customer
      // turns happened in between.
      recentFocusEntities = await resolveRecentFocusEntities(
        user!.id,
        conversation ?? undefined,
      );
    } catch (error) {
      console.error("[ai] focus resolution failed:", error);
    }

    if (conversation) {
      try {
        pendingDraft = await getPendingDraft(conversation);
      } catch (error) {
        console.error("[ai] draft load failed:", error);
      }
      // Explicit cancel-intent clears the draft server-side before the run so
      // a "chhod do" can never leave a stuck draft, even if the model's reply
      // is plain text. Interruptions are NOT treated as cancels.
      if (pendingDraft && CANCEL_DRAFT_PATTERN.test(message)) {
        try {
          await setPendingDraft(conversation, null);
          draftCancelled = true;
          pendingDraft = null;
        } catch (error) {
          console.error("[ai] draft cancel persist failed:", error);
        }
      }
    }
  }

  const context: AgentContext = {
    userId: isAuthenticated ? user!.id : null,
    role: isAuthenticated ? user!.role : null,
    channel,
    requestId,
    conversationId: conversation ?? undefined,
    focusEntity,
    recentFocusEntities,
    pendingDraft,
    firstMessage: isFirstMessage || undefined,
  };

  // Feed the model a bounded recency window of persisted history. Full threads
  // are retained for ownership/authorization, but a tighter window keeps the
  // model focused on the current thread of work and prevents old topics from
  // bleeding into unrelated requests in long conversations.
  const historyWindow = historyRows.slice(-20);

  const inputItems: AgentInputItem[] = buildInputItems(historyWindow, message, {
    focusEntity,
    recentFocusEntities,
    pendingDraft,
    draftCancelled,
    firstMessage: isFirstMessage || undefined,
  });
  const entryAgent: Agent<AgentContext> = getEntryAgent(channel);

  let streamed: StreamedRunResult<AgentContext, Agent<AgentContext, any>>;
  try {
    const runner = new Runner({
      model: AI_MODEL,
      workflowName: channel === "admin" ? "ai_workplace" : "ai_salesman",
      groupId: conversation ?? `guest-${requestId}`,
      traceMetadata: {
        channel,
        requestId,
        actorRole: context.role ?? "guest",
      },
      traceIncludeSensitiveData: false,
    });
    streamed = (await runner.run(entryAgent, inputItems, {
      stream: true,
      context,
      maxTurns: MAX_AGENT_TURNS,
    })) as StreamedRunResult<AgentContext, Agent<AgentContext, any>>;
  } catch (error) {
    // Model/provider config errors surface when the run starts.
    const mapped = handleRunError(error);
    return {
      ok: true,
      response: ndjson(guardrailDoneEvent(mapped.message)),
    };
  }

  let assistantText = "";

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const finish = (event: AiStreamEvent) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };

      try {
        controller.enqueue(
          encoder.encode(
            JSON.stringify({
              type: "meta",
              conversationId: conversation ?? null,
            } satisfies AiStreamEvent) + "\n",
          ),
        );

        for await (const event of streamRunToEvents(streamed)) {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
          if (event.type === "text") {
            assistantText += event.delta;
          }
          if (event.type === "tool") {
            console.log(
              `[ai-debug] tool event: ${event.name} state=${event.state}`,
            );
          }
          if (event.type === "agent") {
            console.log(`[ai-debug] agent event: ${event.name}`);
          }
        }
      } catch (error) {
        const mapped = handleRunError(error);
        finish({ type: "done", output: mapped.message });
      } finally {
        try {
          if (assistantText.trim() && conversation) {
            await saveMessage(conversation, "assistant", assistantText);
            await touchConversation(conversation);
          }
        } catch (persistError) {
          console.error("[ai] assistant message persist failed:", persistError);
        }
        controller.close();
      }
    },
  });

  return { ok: true, response: ndjson(stream) };
}

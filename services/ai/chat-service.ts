import {
  assistant,
  system,
  user,
  type AgentInputItem,
} from "@openai/agents";

import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { formatPKTDate } from "@/lib/time";
import { ServiceError } from "@/services/base";
import {
  missingDraftFields,
  type PendingDraft,
} from "@/services/ai/draft-service";
import type {
  FocusEntity,
  RecentFocusEntities,
} from "@/services/ai/focus-service";

export type AiChannel = "admin" | "salesman";
export type AiMessageRole = "user" | "assistant";

export type ChatMessageRow = {
  id: string;
  conversation_id: string;
  role: AiMessageRole;
  content: string;
  created_at: string;
};

/**
 * AI chat persistence.
 *
 * Conversations and messages are stored per authenticated user and protected
 * by RLS (user_id = auth.uid(), message inserts check conversation ownership).
 * Unauthenticated visitors do not persist conversations — their history is
 * rebuilt from the (bounded) client-supplied history for each turn.
 */
export async function createConversation(
  userId: string,
  channel: AiChannel,
): Promise<string> {
  const supabase = await createSupabaseClient();

  const { data, error } = await supabase
    .from("ai_conversations")
    .insert({ user_id: userId, channel })
    .select("id")
    .single();

  if (error) {
    throw new ServiceError(
      "AI_CONVERSATION_CREATE_FAILED",
      "Failed to create conversation.",
      error,
    );
  }

  return data.id;
}

export async function listUserConversations(
  userId: string,
  channel: AiChannel,
): Promise<{ id: string; updatedAt: string; preview: string }[]> {
  const supabase = await createSupabaseClient();

  const { data, error } = await supabase
    .from("ai_conversations")
    .select("id, updated_at")
    .eq("user_id", userId)
    .eq("channel", channel)
    .order("updated_at", { ascending: false })
    .limit(20);

  if (error) {
    throw new ServiceError(
      "AI_CONVERSATION_READ_FAILED",
      "Failed to load conversations.",
      error,
    );
  }

  const conversations = (data ?? []).map((row) => ({
    id: row.id,
    updatedAt: row.updated_at,
  }));

  // First user message per conversation, used as a short human-readable
  // label in the admin history browser. RLS keeps this scoped to the caller.
  const previews = await Promise.all(
    conversations.map(async (conversation) => {
      const { data: firstUserMessage, error: previewError } = await supabase
        .from("ai_messages")
        .select("content")
        .eq("conversation_id", conversation.id)
        .eq("role", "user")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (previewError) return "";
      return firstUserMessage?.content ?? "";
    }),
  );

  return conversations.map((conversation, index) => ({
    ...conversation,
    preview: previews[index] ?? "",
  }));
}

/**
 * Load the message history for a conversation. RLS guarantees the caller can
 * only ever read their own conversations; an unowned or unknown id yields an
 * empty array.
 */
export async function loadMessages(
  conversationId: string,
): Promise<ChatMessageRow[]> {
  const supabase = await createSupabaseClient();

  const { data, error } = await supabase
    .from("ai_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(40);

  if (error) {
    throw new ServiceError(
      "AI_MESSAGE_READ_FAILED",
      "Failed to load conversation history.",
      error,
    );
  }

  return (data ?? []) as ChatMessageRow[];
}

export async function saveMessage(
  conversationId: string,
  role: AiMessageRole,
  content: string,
): Promise<void> {
  const supabase = await createSupabaseClient();

  const { error } = await supabase.from("ai_messages").insert({
    conversation_id: conversationId,
    role,
    content,
  });

  if (error) {
    throw new ServiceError(
      "AI_MESSAGE_SAVE_FAILED",
      "Failed to save message.",
      error,
    );
  }
}

/**
 * Touch the conversation's updated_at so ordering by recency stays correct.
 */
export async function touchConversation(
  conversationId: string,
): Promise<void> {
  const supabase = await createSupabaseClient();

  const { error } = await supabase
    .from("ai_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  if (error) {
    throw new ServiceError(
      "AI_CONVERSATION_UPDATE_FAILED",
      "Failed to update conversation.",
      error,
    );
  }
}

/**
 * Build the conversation context line every agent sees at the start of a run.
 *
 * - Always injects the real server date in PKT so the AI never guesses today.
 * - When a tracked focus entity exists, states it explicitly so ambiguous
 *   follow-ups ("khudhi karo", "iska", "is order ko") resolve against the last
 *   named/actioned entity instead of the model's own attention.
 * - When a pending draft is active, states it explicitly so the next reply is
 *   interpreted as filling THAT draft — never as a new/unrelated request.
 */
export function buildContextItems(options: {
  focusEntity?: FocusEntity | null;
  recentFocusEntities?: RecentFocusEntities | null;
  pendingDraft?: PendingDraft | null;
  draftCancelled?: boolean;
}): AgentInputItem[] {
  const {
    focusEntity,
    recentFocusEntities,
    pendingDraft,
    draftCancelled,
  } = options;
  const lines: string[] = [
    `Today's date (Asia/Karachi): ${formatPKTDate()}. Use this date for any business date question.`,
  ];

  if (focusEntity) {
    lines.push(
      `Current focus: ${focusEntity.type} "${focusEntity.name}" (id: ${focusEntity.id}). ` +
        "This line exists ONLY to resolve ambiguous follow-ups like \"khudhi karo\", \"iska\", " +
        "\"is product ko\", \"is order ko\" in the CURRENT message. It is NOT a suggestion to " +
        "mention, re-verify, or act on this entity. If the current message is about a different " +
        "topic (sales, orders, customers, categories, a different product, etc.), IGNORE this " +
        "line completely — do not mention or reference the focused entity at all. If the current " +
        "request clearly names or refers to a different entity, ignore this line. If this focus " +
        "seems stale for the current request, ask one short clarifying question instead of guessing. " +
        "SHORT VERB-ONLY CONTINUATIONS (very short messages with NO entity name and NO entity type " +
        "that continue the previous action — \"delete\", \"delete ua?\", \"update karo\", \"haan\", " +
        "\"kar do\") MUST resolve against THIS focused entity of the matching type — never against a " +
        "different, earlier-discussed entity, and never by guessing an entity from raw conversation " +
        "memory (if the focus line has no entity of the matching type, ask ONE short clarifying " +
        "question instead of acting). This verb-only rule does NOT apply to references that NAME an " +
        "entity type (\"iska order\", \"us customer\", \"wo product\") — resolve those against the " +
        "\"Recently discussed entities\" list below (most recent entity of that type), not against " +
        "this single focus line.",
    );
  }

  if (recentFocusEntities) {
    const recent = [
      recentFocusEntities.product ? `product "${recentFocusEntities.product.name}"` : null,
      recentFocusEntities.order ? `order "${recentFocusEntities.order.name}"` : null,
      recentFocusEntities.customer
        ? `customer "${recentFocusEntities.customer.name}"`
        : null,
    ].filter(Boolean);
    if (recent.length > 0) {
      lines.push(
        `Recently discussed entities (most recent per type): ${recent.join(", ")}. ` +
          "These are ONLY for resolving ambiguous references in the CURRENT message, " +
          "regardless of how many turns back the entity was discussed. If the current " +
          "message uses an ambiguous reference to an entity type (" +
          "\"iska order\", \"wo product\", \"us customer\"), match it to the most recent " +
          "entity of that type listed here (this list takes precedence over the single \"Current " +
          "focus\" line for any reference that names an entity type). Do NOT act on any of these " +
          "entities unless " +
          "the current message clearly refers to them. If the current message names " +
          "something not listed here, prefer what the current message names.",
      );
    }
  }

  if (draftCancelled) {
    lines.push(
      "PENDING DRAFT: the user just cancelled the pending draft in this conversation. " +
        "There is no active draft now. Continue the conversation normally.",
    );
  }

  if (pendingDraft) {
    const missing = missingDraftFields(pendingDraft.kind, pendingDraft.fields);
    const collected = Object.entries(pendingDraft.fields)
      .map(([key, value]) =>
        `${key}=${typeof value === "string" ? `"${value}"` : String(value)}`,
      )
      .join(", ");

    const nextField = pendingDraft.expect ?? missing[0] ?? null;
    const completionNote =
      pendingDraft.kind === "product-edit"
        ? "No mandatory fields remain for this edit. Keep collecting any further fields the owner wants changed, then apply the edit once the request is fully specified and clear the draft with cancel_draft."
        : missing.length === 0
          ? "The draft is complete. Proceed to finish the task (create the product / place the order), then clear the draft with cancel_draft."
          : `Ask the owner for the next missing field.`;

    lines.push(
      `ACTIVE PENDING DRAFT (this conversation): kind=${pendingDraft.kind}` +
        (pendingDraft.targetId ? `, targetId=${pendingDraft.targetId}` : "") +
        `. Already collected: ${collected || "(none)"}. ` +
        `Still missing: ${missing.length > 0 ? missing.join(", ") : "(none)"}. ` +
        (nextField
          ? ` The next reply about this task should be read as the value for field "${nextField}". `
          : "") +
        "RULES for this draft: (1) While a draft is active, interpret the user's reply on this task as FILLING THE DRAFT's next missing field — never as a new, unrelated request, and never match it against unrelated existing records. " +
        "(2) If the user asks an unrelated question mid-draft (e.g. about sales, orders, another product) with no draft-filling intent, answer that question normally and DO NOT clear the draft — resume the draft when the user returns to it, and keep saving progress with the draft tool after every relevant exchange. " +
        "(3) Cancel the draft ONLY when the user explicitly says 'chhod do' / 'cancel it' / clearly abandons the task (call cancel_draft). " +
        "(4) " + completionNote,
    );
  }

  return [system(lines.join("\n"))];
}

/**
 * Convert persisted messages (plus the current user message) into Agents SDK
 * input items so each turn continues the conversation with real history. A
 * system context line (real PKT date + tracked focus entity) is prepended.
 */
export function buildInputItems(
  history: ChatMessageRow[],
  currentMessage: string,
  options?: {
    focusEntity?: FocusEntity | null;
    recentFocusEntities?: RecentFocusEntities | null;
    pendingDraft?: PendingDraft | null;
    draftCancelled?: boolean;
  },
): AgentInputItem[] {
  const items: AgentInputItem[] = buildContextItems(options ?? {});

  for (const message of history) {
    if (!message.content.trim()) continue;
    if (message.role === "user") {
      items.push(user(message.content));
    } else {
      items.push(assistant(message.content));
    }
  }

  items.push(user(currentMessage));

  return items;
}
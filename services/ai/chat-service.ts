import { assistant, user, type AgentInputItem } from "@openai/agents";

import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { ServiceError } from "@/services/base";

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
): Promise<{ id: string; updatedAt: string }[]> {
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

  return (data ?? []).map((row) => ({
    id: row.id,
    updatedAt: row.updated_at,
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
 * Convert persisted messages (plus the current user message) into Agents SDK
 * input items so each turn continues the conversation with real history.
 */
export function buildInputItems(
  history: ChatMessageRow[],
  currentMessage: string,
): AgentInputItem[] {
  const items: AgentInputItem[] = [];

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
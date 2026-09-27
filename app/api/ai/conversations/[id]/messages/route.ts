import { NextRequest } from "next/server";

import { getAuthUser } from "@/lib/auth/session";
import { loadMessages } from "@/services/ai/chat-service";

/**
 * GET /api/ai/conversations/[id]/messages
 *
 * Returns the messages for a conversation. RLS ensures users can only
 * read their own conversations.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser();

  if (!user) {
    return new Response(JSON.stringify({ error: "Sign in required." }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const { id } = await params;

  try {
    const messages = await loadMessages(id);
    // RLS guarantees an unowned conversation returns empty rows.
    if (messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Conversation not found." }),
        { status: 404, headers: { "content-type": "application/json" } },
      );
    }
    return new Response(JSON.stringify({ messages }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error("[ai-messages-api] failed:", error);
    return new Response(JSON.stringify({ error: "Failed to load messages." }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

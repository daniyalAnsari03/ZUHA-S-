import { NextRequest } from "next/server";

import { getAuthUser } from "@/lib/auth/session";
import { listUserConversations } from "@/services/ai/chat-service";

/**
 * GET /api/ai/conversations?channel=admin
 *
 * Returns the current user's recent AI conversations for the given channel.
 * Used by the conversation history browser in the admin AI Workplace.
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser();

  if (!user || user.role !== "admin") {
    return new Response(JSON.stringify({ error: "Admin access required." }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  }

  const { searchParams } = new URL(request.url);
  const channel = (searchParams.get("channel") ?? "admin") as
    "admin" | "salesman";

  try {
    const conversations = await listUserConversations(user.id, channel);
    return new Response(JSON.stringify({ conversations }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error("[ai-conversations-api] failed:", error);
    return new Response(
      JSON.stringify({ error: "Failed to load conversations." }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }
}

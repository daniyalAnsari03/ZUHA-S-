import { NextRequest } from "next/server";

import { getAuthUser } from "@/lib/auth/session";
import { runChatTurn } from "@/lib/ai/run-turn";

/**
 * POST /api/ai/admin
 *
 * Admin-only entry point for the AI Workplace. The frontend (use-ai-chat.ts)
 * sends to `/api/ai/${channel}`, which resolves to this route for the admin
 * channel. Delegates to the shared runChatTurn orchestrator which handles:
 *   - conversation persistence
 *   - OpenAI Agents SDK invocation
 *   - streaming NDJSON events
 *   - audit logging
 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser();

  if (!user || user.role !== "admin") {
    return new Response(
      JSON.stringify({ error: "Admin access required for the AI Workplace." }),
      { status: 403, headers: { "content-type": "application/json" } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body." }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }

  const result = await runChatTurn({ channel: "admin", user, body });

  if (!result.ok) {
    return new Response(JSON.stringify({ error: result.message }), {
      status: result.status,
      headers: { "content-type": "application/json" },
    });
  }

  return result.response;
}

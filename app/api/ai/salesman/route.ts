import { NextRequest } from "next/server";

import { getAuthUser } from "@/lib/auth/session";
import { runChatTurn } from "@/lib/ai/run-turn";

/**
 * POST /api/ai/salesman
 *
 * Storefront entry point for the AI Salesman. Open to guests, customers and
 * admins. Customer-scoped order tools enforce their own role guardrails, so a
 * guest can never read anyone's order data.
 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body." }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }

  const result = await runChatTurn({
    channel: "salesman",
    user:
      user && user.role
        ? { id: user.id, email: user.email, role: user.role }
        : null,
    body,
  });

  if (!result.ok) {
    return new Response(JSON.stringify({ error: result.message }), {
      status: result.status,
      headers: { "content-type": "application/json" },
    });
  }

  return result.response;
}
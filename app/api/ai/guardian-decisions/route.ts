import { NextRequest } from "next/server";

import { getAuthUser } from "@/lib/auth/session";
import { listGuardianDecisions } from "@/services/ai/guardian-service";

/**
 * GET /api/ai/guardian-decisions
 *
 * Admin-only endpoint to retrieve Guardian decisions (security decisions made
 * for AI actions). Newest entries first. Used by the admin AI Workplace.
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser();

  if (!user || user.role !== "admin") {
    return new Response(
      JSON.stringify({ error: "Admin access required." }),
      { status: 403, headers: { "content-type": "application/json" } },
    );
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(
    Math.max(Number(searchParams.get("limit") ?? "20"), 1),
    100,
  );
  const decision = searchParams.get("decision") as
    | "allow"
    | "deny"
    | "require_approval"
    | undefined;

  try {
    const decisions = await listGuardianDecisions({ limit, decision });
    return new Response(JSON.stringify({ decisions }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error("[guardian-api] failed:", error);
    return new Response(
      JSON.stringify({ error: "Failed to load Guardian decisions." }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }
}
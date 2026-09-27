import { NextRequest } from "next/server";

import { getAuthUser } from "@/lib/auth/session";
import { listAiAuditLogs } from "@/services/ai/audit-service";

/**
 * GET /api/ai/audit-logs
 *
 * Admin-only endpoint to retrieve recent AI audit log entries. Returns the
 * newest entries first. Used by the admin AI Workplace audit trail viewer.
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
  const limit = Math.min(
    Math.max(Number(searchParams.get("limit") ?? "20"), 1),
    100,
  );
  const agentName = searchParams.get("agent") || undefined;
  const status = searchParams.get("status") as
    "granted" | "denied" | "error" | undefined;

  try {
    const logs = await listAiAuditLogs({ limit, agentName, status });
    return new Response(JSON.stringify({ logs }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error("[ai-audit-api] failed:", error);
    return new Response(
      JSON.stringify({ error: "Failed to load audit logs." }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }
}

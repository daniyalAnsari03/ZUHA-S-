import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./types";

/**
 * Service-role Supabase client for trusted server-side operations.
 *
 * SECURITY WARNING:
 * - This client BYPASSES RLS by design. It must NEVER be exposed to the
 *   browser, routed through client code, or used with unverified input.
 * - It may only be used inside server code behind its own authorization
 *   checks (see services/) and must never be returned to the client.
 * - Every call must validate that the requester is authorized (e.g. admin
 *   role) BEFORE execution, and results must be verified.
 */
export function createAdminClient(): SupabaseClient<Database> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured on the server.",
    );
  }

  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

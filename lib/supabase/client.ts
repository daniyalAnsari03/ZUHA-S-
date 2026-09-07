import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "./types";

import { getPublicKey } from "./key";

/**
 * Browser-side Supabase client.
 *
 * Used only in Client Components for authenticated user operations
 * that respect RLS. Never place service-role credentials here.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    getPublicKey(),
  );
}

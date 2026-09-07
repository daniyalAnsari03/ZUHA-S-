/**
 * Public Supabase key resolution.
 *
 * Supabase exposes a public key that is safe for both browser and server use.
 * This project prefers the new-style publishable key and falls back to the
 * legacy anon key for compatibility. This module has NO server-only imports so
 * it is safe to import from both Server Components and Client Components.
 */
export function getPublicKey(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    ""
  );
}

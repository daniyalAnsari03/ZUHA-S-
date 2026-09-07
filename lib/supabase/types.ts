/**
 * Placeholder Supabase Database types.
 *
 * This type is a foundation placeholder for Phase 1. As migrations are
 * added in later phases, regenerate the concrete types with:
 *
 *   npx supabase gen types typescript --project-id <ref> > types/database.gen.ts
 *
 * and point the `Database` type below at the generated schema. Keeping the
 * client factory generic across the schema allows this to be swapped without
 * rewriting service code.
 */

// Minimal placeholder rows for the foundation tables established in Phase 1.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          role?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          role?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

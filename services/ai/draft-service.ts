import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";
import { ServiceError } from "@/services/base";

/**
 * Server-side pending-draft state for AI conversations.
 *
 * A "pending draft" holds the pieces of information an agent is collecting
 * across multiple turns for one task:
 *   - product-create  — new product (name, price, stockQuantity, category,
 *                       fabric, color, description, sku, imageUrl, ...)
 *   - product-edit    — editing an existing product (targetId = product UUID)
 *   - checkout        — customer checkout details (name, phone, email,
 *                       shippingAddress, city, optional postalCode/orderNotes)
 *
 * Drafts live on the ai_conversations.draft jsonb column, are scoped to a
 * single conversation, and are protected by the same RLS as the conversation
 * row itself (owner-only read/update). They let the agent resume an
 * interrupted task exactly where it stopped instead of re-deriving state from
 * raw message history.
 */

export type PendingDraftKind = "product-create" | "product-edit" | "checkout";

export type PendingDraft = {
  kind: PendingDraftKind;
  fields: Record<string, unknown>;
  /** Product UUID when editing an existing product. */
  targetId?: string;
  /** The single next field the agent is currently awaiting from the user. */
  expect?: string;
  updatedAt: string;
};

/** Mandatory fields per draft kind before the task can be finished. */
export const REQUIRED_DRAFT_FIELDS: Record<PendingDraftKind, string[]> = {
  "product-create": ["name", "price", "stockQuantity"],
  "product-edit": [],
  checkout: ["name", "phone", "email", "shippingAddress", "city"],
};

export function missingDraftFields(
  kind: PendingDraftKind,
  fields: Record<string, unknown>,
): string[] {
  return REQUIRED_DRAFT_FIELDS[kind].filter((field) => {
    const value = fields[field];
    if (value === null || value === undefined) return true;
    if (typeof value === "string" && value.trim() === "") return true;
    return false;
  });
}

/**
 * Load the active pending draft for a conversation (RLS-scoped to the row
 * owner). Returns null when no draft is stored or the stored value is not a
 * valid draft object.
 */
export async function getPendingDraft(
  conversationId: string,
): Promise<PendingDraft | null> {
  const supabase = await createSupabaseClient();

  const { data, error } = await (
    supabase.from("ai_conversations") as unknown as {
      select(column: "draft"): {
        eq(column: "id", value: string): Promise<{
          data: { draft: Json | null }[] | null;
          error: { message: string } | null;
        }>;
      };
    }
  )
    .select("draft")
    .eq("id", conversationId);

  if (error) {
    throw new ServiceError(
      "AI_DRAFT_READ_FAILED",
      "Failed to read the pending draft.",
      error,
    );
  }

  const raw = data?.[0]?.draft ?? null;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const draft = raw as Partial<PendingDraft>;
  if (
    typeof draft.kind !== "string" ||
    !["product-create", "product-edit", "checkout"].includes(draft.kind)
  ) {
    return null;
  }

  return {
    kind: draft.kind as PendingDraftKind,
    fields:
      draft.fields && typeof draft.fields === "object"
        ? (draft.fields as Record<string, unknown>)
        : {},
    targetId: typeof draft.targetId === "string" ? draft.targetId : undefined,
    expect: typeof draft.expect === "string" ? draft.expect : undefined,
    updatedAt:
      typeof draft.updatedAt === "string"
        ? draft.updatedAt
        : new Date().toISOString(),
  };
}

/**
 * Store or clear the pending draft for a conversation. Passing `null` clears
 * it (task completed or cancelled). RLS-scoped to the row owner, like every
 * other conversation write. The generated Database types predate the `draft`
 * column, so the payload is narrowed to the column we write.
 */
export async function setPendingDraft(
  conversationId: string,
  draft: PendingDraft | null,
): Promise<void> {
  const supabase = await createSupabaseClient();

  const payload = {
    draft: draft === null ? null : ((draft as unknown) as Json),
  };

  const { error } = await (
    supabase.from("ai_conversations") as unknown as {
      update(payload: { draft: Json | null }): {
        eq(column: "id", value: string): Promise<{
          error: { message: string } | null;
        }>;
      };
    }
  )
    .update(payload)
    .eq("id", conversationId);

  if (error) {
    throw new ServiceError(
      "AI_DRAFT_SAVE_FAILED",
      "Failed to save the pending draft.",
      error,
    );
  }
}
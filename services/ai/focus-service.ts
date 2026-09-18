import { createAdminClient } from "@/lib/supabase/admin";

/** The kind of entity the conversation is currently focused on. */
export type FocusEntityType = "product" | "order" | "customer";

export type FocusEntity = {
  type: FocusEntityType;
  id: string;
  name: string;
  /** ISO timestamp of the tool action that most recently set this focus. */
  at: string;
};

const ENTITY_TYPES: FocusEntityType[] = ["product", "order", "customer"];

/**
 * Resolve the "current focus entity" for a user's conversation.
 *
 * The tool audit trail (`ai_audit_logs`) is the authoritative record of every
 * entity a user named or acted on. The tagger tools now stamp entityType +
 * entityId on their audit lines, so the latest such line for this user +
 * conversation tells us which product/order/customer is currently in focus.
 *
 * STRICT SCOPING (CRITICAL): focus resolves ONLY from this conversation's own
 * audit trail (`detail.conversationId`). Without a conversation id there is
 * NO focus — the resolver must never fall back to a user-wide scan, or a
 * brand-new conversation would inherit entities from earlier conversations
 * (this was the Khirke Jamawar leak). Best-effort: a failure yields null.
 */
export async function resolveAiFocusEntity(
  userId: string,
  conversationId?: string,
): Promise<FocusEntity | null> {
  if (userId === "guest") return null;
  // Conversation-scoped only. No conversation → no focus, ever.
  if (!conversationId) return null;

  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("ai_audit_logs")
      .select("entity_type, entity_id, created_at")
      .eq("user_id", userId)
      .eq("detail->>conversationId", conversationId)
      .not("entity_type", "is", null)
      .not("entity_id", "is", null)
      .in("entity_type", ENTITY_TYPES)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;

    const entityType = data.entity_type as FocusEntityType;
    const entityId = data.entity_id;
    const at = data.created_at as string;

    if (!entityId) return null;

    const name = await resolveEntityName(entityType, entityId, supabase);
    if (!name) return null;

    return { type: entityType, id: entityId, name, at };
  } catch (error) {
    console.error("[ai-focus] focus resolution failed:", error);
    return null;
  }
}

/** The most recently named/acted-on entity of each focus type. */
export type RecentFocusEntities = {
  product?: FocusEntity;
  order?: FocusEntity;
  customer?: FocusEntity;
};

/**
 * Resolve the most recent focus entity of EACH type (product, order,
 * customer) for a user's conversation.
 *
 * A single "latest" focus is not enough: if a user discusses an order and then
 * three unrelated product/customer turns happen, the order is no longer the
 * latest entity yet ambiguous follow-ups like "is order ki baat ho rahi thi"
 * or "iska order number kya tha" still refer to it. Returning the most recent
 * entity per type lets every follow-up type resolve against its own most
 * recent entity while staying scoped to this conversation (RLS + audit trail).
 *
 * Best-effort: a missing type simply yields no entry for that type.
 */
export async function resolveRecentFocusEntities(
  userId: string,
  conversationId?: string,
): Promise<RecentFocusEntities> {
  if (userId === "guest") return {};
  // Conversation-scoped only. No conversation → zero recent entities, so a
  // brand-new thread never inherits products/orders/customers from another
  // conversation's audit trail.
  if (!conversationId) return {};

  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("ai_audit_logs")
      .select("entity_type, entity_id, created_at")
      .eq("user_id", userId)
      .eq("detail->>conversationId", conversationId)
      .not("entity_type", "is", null)
      .not("entity_id", "is", null)
      .in("entity_type", ENTITY_TYPES)
      .order("created_at", { ascending: false })
      .limit(60);

    if (error) return {};

    const result: RecentFocusEntities = {};
    for (const row of data ?? []) {
      const entityType = row.entity_type as FocusEntityType;
      if (result[entityType]) continue; // already have the newest for this type
      const entityId = row.entity_id as string;
      if (!entityId) continue;

      const name = await resolveEntityName(entityType, entityId, supabase);
      if (!name) continue;

      result[entityType] = {
        type: entityType,
        id: entityId,
        name,
        at: row.created_at as string,
      };
      if (result.product && result.order && result.customer) break;
    }

    return result;
  } catch (error) {
    console.error("[ai-focus] per-type focus resolution failed:", error);
    return {};
  }
}

async function resolveEntityName(
  entityType: FocusEntityType,
  entityId: string,
  supabase: ReturnType<typeof createAdminClient>,
): Promise<string | null> {
  try {
    if (entityType === "product") {
      const { data } = await supabase
        .from("products")
        .select("name")
        .eq("id", entityId)
        .maybeSingle();
      return data?.name ?? null;
    }
    if (entityType === "order") {
      const { data } = await supabase
        .from("orders")
        .select("order_number")
        .eq("id", entityId)
        .maybeSingle();
      return data?.order_number ?? null;
    }
    const { data } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", entityId)
      .maybeSingle();
    return data?.full_name ?? null;
  } catch {
    return null;
  }
}
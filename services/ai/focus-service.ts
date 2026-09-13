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
 * This mechanism needs no extra schema: it is append-only, RLS-separated (the
 * audit writer uses the service-role client) and works across reloads, agent
 * switching and device changes. Resolution is best-effort — a failure simply
 * yields null and the turn continues without focus context.
 */
export async function resolveAiFocusEntity(
  userId: string,
  conversationId?: string,
): Promise<FocusEntity | null> {
  if (userId === "guest") return null;

  try {
    const supabase = createAdminClient();

    let query = supabase
      .from("ai_audit_logs")
      .select("entity_type, entity_id, created_at")
      .eq("user_id", userId)
      .not("entity_type", "is", null)
      .not("entity_id", "is", null)
      .in("entity_type", ENTITY_TYPES)
      .order("created_at", { ascending: false })
      .limit(1);

    if (conversationId) {
      // The audit detail now carries the conversation id, so focus stays
      // scoped to THIS thread even when the user has several conversations.
      query = query.eq("detail->>conversationId", conversationId);
    }

    const { data, error } = await query.maybeSingle();
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
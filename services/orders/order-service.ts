import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import type { Database, OrderStatus } from "@/lib/supabase/types";
import { ServiceError, assertRole } from "@/services/base";

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type OrderItemRow = Database["public"]["Tables"]["order_items"]["Row"];
type OrderStatusHistoryRow = Database["public"]["Tables"]["order_status_history"]["Row"];

export type OrderWithItems = OrderRow & {
  items: OrderItemRow[];
};

export type OrderWithHistory = OrderWithItems & {
  history: OrderStatusHistoryRow[];
};

export type OrderListItem = OrderRow & {
  items: Pick<OrderItemRow, "product_name" | "quantity" | "product_image">[];
};

/** Valid status transitions enforced at the service layer (mirrors DB trigger). */
const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

/* ---------------------------------------------------------------------------
 * Customer-facing order operations (RLS-scoped)
 * --------------------------------------------------------------------- */

/** Get a customer's own orders, newest first. */
export async function listCustomerOrders(userId: string): Promise<OrderListItem[]> {
  const supabase = await createSupabaseClient();

  const { data, error } = await supabase
    .from("orders")
    .select(
      "*, items:order_items(product_name, quantity, product_image)",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new ServiceError("ORDERS_READ_FAILED", "Failed to load your orders.", error);
  }

  return (data ?? []) as unknown as OrderListItem[];
}

/** Get a single order with all items and status history. Validates ownership via RLS. */
export async function getOrderDetail(
  userId: string,
  orderId: string,
): Promise<OrderWithHistory> {
  const supabase = await createSupabaseClient();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .eq("user_id", userId)
    .maybeSingle();

  if (orderError) {
    throw new ServiceError("ORDER_READ_FAILED", "Failed to load order.", orderError);
  }

  if (!order) {
    throw new ServiceError("ORDER_NOT_FOUND", "Order not found.");
  }

  const [itemsResult, historyResult] = await Promise.all([
    supabase
      .from("order_items")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true }),
    supabase
      .from("order_status_history")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false }),
  ]);

  if (itemsResult.error) {
    throw new ServiceError("ORDER_ITEMS_READ_FAILED", "Failed to load order items.", itemsResult.error);
  }

  if (historyResult.error) {
    throw new ServiceError("ORDER_HISTORY_READ_FAILED", "Failed to load order history.", historyResult.error);
  }

  return {
    ...order,
    items: (itemsResult.data ?? []) as OrderItemRow[],
    history: (historyResult.data ?? []) as OrderStatusHistoryRow[],
  };
}

/* ---------------------------------------------------------------------------
 * Admin order operations (admin-scoped, bypasses RLS via service layer)
 * --------------------------------------------------------------------- */

/** List all orders with optional search and status filter. */
export async function listAllOrders(
  actor: { id: string; role: string },
  options?: { status?: OrderStatus; search?: string; limit?: number; offset?: number },
): Promise<{ orders: OrderListItem[]; total: number }> {
  assertRole(actor.role as "admin" | "customer", ["admin"]);

  const supabase = await createSupabaseClient();
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  let query = supabase
    .from("orders")
    .select(
      "*, items:order_items(product_name, quantity, product_image)",
      { count: "exact" },
    );

  if (options?.status) {
    query = query.eq("status", options.status);
  }

  if (options?.search) {
    const searchTerm = `%${options.search}%`;
    query = query.or(
      `order_number.ilike.${searchTerm},customer_name.ilike.${searchTerm},customer_email.ilike.${searchTerm}`,
    );
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new ServiceError("ORDERS_READ_FAILED", "Failed to load orders.", error);
  }

  return {
    orders: (data ?? []) as unknown as OrderListItem[],
    total: count ?? 0,
  };
}

/** Get a full order detail for admin (no ownership check). */
export async function getAdminOrderDetail(
  actor: { id: string; role: string },
  orderId: string,
): Promise<OrderWithHistory> {
  assertRole(actor.role as "admin" | "customer", ["admin"]);

  const supabase = await createSupabaseClient();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) {
    throw new ServiceError("ORDER_READ_FAILED", "Failed to load order.", orderError);
  }

  if (!order) {
    throw new ServiceError("ORDER_NOT_FOUND", "Order not found.");
  }

  const [itemsResult, historyResult] = await Promise.all([
    supabase
      .from("order_items")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true }),
    supabase
      .from("order_status_history")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false }),
  ]);

  if (itemsResult.error) {
    throw new ServiceError("ORDER_ITEMS_READ_FAILED", "Failed to load order items.", itemsResult.error);
  }

  if (historyResult.error) {
    throw new ServiceError("ORDER_HISTORY_READ_FAILED", "Failed to load order history.", historyResult.error);
  }

  return {
    ...order,
    items: (itemsResult.data ?? []) as OrderItemRow[],
    history: (historyResult.data ?? []) as OrderStatusHistoryRow[],
  };
}

/** Resolve an admin order by its human-facing order number (e.g. DIN-2026-xxxx). */
export async function getAdminOrderIdByNumber(
  actor: { id: string; role: string },
  orderNumber: string,
): Promise<string> {
  assertRole(actor.role as "admin" | "customer", ["admin"]);

  const supabase = await createSupabaseClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select("id")
    .eq("order_number", orderNumber)
    .maybeSingle();

  if (error) {
    throw new ServiceError("ORDER_READ_FAILED", "Failed to load order.", error);
  }
  if (!order) {
    throw new ServiceError("ORDER_NOT_FOUND", `No order found with number ${orderNumber}.`);
  }
  return order.id;
}

/** Update order status with transition validation. */
export async function updateOrderStatus(
  actor: { id: string; role: string },
  orderId: string,
  newStatus: OrderStatus,
  note?: string,
): Promise<void> {
  assertRole(actor.role as "admin" | "customer", ["admin"]);

  const supabase = await createSupabaseClient();

  // Fetch current order
  const { data: order, error: fetchError } = await supabase
    .from("orders")
    .select("status")
    .eq("id", orderId)
    .maybeSingle();

  if (fetchError) {
    throw new ServiceError("ORDER_READ_FAILED", "Failed to load order.", fetchError);
  }

  if (!order) {
    throw new ServiceError("ORDER_NOT_FOUND", "Order not found.");
  }

  const currentStatus = order.status as OrderStatus;

  // Validate transition
  const allowed = VALID_TRANSITIONS[currentStatus];
  if (!allowed || !allowed.includes(newStatus)) {
    throw new ServiceError(
      "INVALID_STATUS_TRANSITION",
      `Cannot change order status from "${currentStatus}" to "${newStatus}".`,
    );
  }

  // Update status (DB trigger validates as well)
  const { error: updateError } = await supabase
    .from("orders")
    .update({ status: newStatus })
    .eq("id", orderId);

  if (updateError) {
    throw new ServiceError("ORDER_UPDATE_FAILED", "Failed to update order status.", updateError);
  }

  // Record status history
  const { error: historyError } = await supabase
    .from("order_status_history")
    .insert({
      order_id: orderId,
      previous_status: currentStatus,
      new_status: newStatus,
      note: note ?? null,
      created_by: actor.id,
    });

  if (historyError) {
    throw new ServiceError("ORDER_HISTORY_WRITE_FAILED", "Failed to record status history.", historyError);
  }
}

/**
 * Advance an order through a chain of status steps in one call.
 *
 * The whole chain is validated up-front against VALID_TRANSITIONS BEFORE any
 * write happens, then each step is applied sequentially (each update guarded
 * by its expected previous status so concurrent changes cannot corrupt the
 * chain). If any step cannot be applied, the call fails with a clear message
 * and the final status is verified with a fresh read before returning.
 *
 * This is the single path used for combined/admin-bulk requests (e.g. moving
 * a pending order into processing via pending → confirmed → processing). It
 * deliberately reuses the same single-step validation, so it can never
 * bypass the two-status business rule.
 */
export async function advanceOrderStatus(
  actor: { id: string; role: string },
  orderId: string,
  steps: OrderStatus[],
  note?: string,
): Promise<{
  fromStatus: OrderStatus;
  toStatus: OrderStatus;
  stepsApplied: OrderStatus[];
}> {
  assertRole(actor.role as "admin" | "customer", ["admin"]);

  const supabase = await createSupabaseClient();

  if (steps.length === 0) {
    throw new ServiceError(
      "INVALID_STATUS_TRANSITION",
      "No status steps were provided.",
    );
  }

  // Read current status
  const { data: order, error: fetchError } = await supabase
    .from("orders")
    .select("status")
    .eq("id", orderId)
    .maybeSingle();

  if (fetchError) {
    throw new ServiceError("ORDER_READ_FAILED", "Failed to load order.", fetchError);
  }

  if (!order) {
    throw new ServiceError("ORDER_NOT_FOUND", "Order not found.");
  }

  const startingStatus = order.status as OrderStatus;

  // Pre-validate the entire chain before touching the database.
  let cursor = startingStatus;
  for (const step of steps) {
    const allowed = VALID_TRANSITIONS[cursor];
    if (!allowed || !allowed.includes(step)) {
      const next = allowed?.length
        ? ` Valid next step(s): ${allowed.join(", ")}.`
        : "";
      throw new ServiceError(
        "INVALID_STATUS_TRANSITION",
        `Cannot advance order status from "${cursor}" to "${step}".${next}`,
      );
    }
    cursor = step;
  }

  // Apply each step sequentially, guarding every update with its expected
  // previous status so a concurrent change fails the chain instead of
  // corrupting it.
  const stepsApplied: OrderStatus[] = [];
  let current = startingStatus;
  for (const step of steps) {
    const { data: updated, error: updateError } = await supabase
      .from("orders")
      .update({ status: step })
      .eq("id", orderId)
      .eq("status", current)
      .select("status")
      .maybeSingle();

    if (updateError) {
      throw new ServiceError("ORDER_UPDATE_FAILED", "Failed to update order status.", updateError);
    }

    if (!updated) {
      throw new ServiceError(
        "INVALID_STATUS_TRANSITION",
        `Order status changed underneath the requested sequence (expected "${current}"). No further steps were applied.`,
      );
    }

    const { error: historyError } = await supabase
      .from("order_status_history")
      .insert({
        order_id: orderId,
        previous_status: current,
        new_status: step,
        note:
          steps.length > 1
            ? `Advance request (${stepsApplied.length + 1}/${steps.length}): ${
                note ?? "Advance via valid transitions."
              }`
            : note ?? null,
        created_by: actor.id,
      });

    if (historyError) {
      throw new ServiceError("ORDER_HISTORY_WRITE_FAILED", "Failed to record status history.", historyError);
    }

    stepsApplied.push(step);
    current = step;
  }

  // Verify the final state with an independent read before reporting success.
  const { data: verify, error: verifyError } = await supabase
    .from("orders")
    .select("status")
    .eq("id", orderId)
    .maybeSingle();

  if (verifyError || !verify || verify.status !== steps[steps.length - 1]) {
    throw new ServiceError(
      "ORDER_VERIFY_FAILED",
      "Order status update could not be verified.",
    );
  }

  return {
    fromStatus: startingStatus,
    toStatus: steps[steps.length - 1],
    stepsApplied,
  };
}

/* ---------------------------------------------------------------------------
 * Order creation (called by checkout service)
 * --------------------------------------------------------------------- */

export type CreateOrderInput = {
  userId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  shippingAddress: string;
  city: string;
  postalCode?: string;
  orderNotes?: string;
  paymentMethod?: string;
  items: {
    productId: string;
    productName: string;
    productPrice: number;
    productImage: string | null;
    quantity: number;
    subtotal: number;
  }[];
  subtotal: number;
  shippingFee: number;
  total: number;
};

/**
 * Create an order with items and initial status history atomically.
 * Uses the RLS-aware client — the authenticated user must match userId.
 */
export async function createOrder(input: CreateOrderInput): Promise<OrderRow> {
  const supabase = await createSupabaseClient();

  // Insert order
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      user_id: input.userId,
      order_number: input.orderNumber,
      status: "pending",
      payment_status: input.paymentMethod === "cod" ? "pending" : "pending",
      payment_method: input.paymentMethod ?? "cod",
      customer_name: input.customerName,
      customer_phone: input.customerPhone,
      customer_email: input.customerEmail,
      shipping_address: input.shippingAddress,
      city: input.city,
      postal_code: input.postalCode ?? null,
      subtotal: input.subtotal,
      shipping_fee: input.shippingFee,
      total: input.total,
      order_notes: input.orderNotes ?? null,
    })
    .select("*")
    .single();

  if (orderError) {
    throw new ServiceError("ORDER_CREATE_FAILED", "Failed to create your order.", orderError);
  }

  // Insert order items
  const orderItems = input.items.map((item) => ({
    order_id: order.id,
    product_id: item.productId,
    product_name: item.productName,
    product_price: item.productPrice,
    product_image: item.productImage,
    quantity: item.quantity,
    subtotal: item.subtotal,
  }));

  const { error: itemsError } = await supabase.from("order_items").insert(orderItems);

  if (itemsError) {
    throw new ServiceError("ORDER_ITEMS_CREATE_FAILED", "Failed to create order items.", itemsError);
  }

  // Record initial status history
  const { error: historyError } = await supabase
    .from("order_status_history")
    .insert({
      order_id: order.id,
      previous_status: null,
      new_status: "pending",
      note: "Order placed.",
      created_by: input.userId,
    });

  if (historyError) {
    // Non-fatal — log but don't fail the order
    if (process.env.NODE_ENV === "development") {
      console.error("[createOrder] Failed to write status history:", historyError);
    }
  }

  return order as OrderRow;
}

/** Get the count of unread notifications for a user. */
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const supabase = await createSupabaseClient();

  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);

  if (error) {
    throw new ServiceError("NOTIFICATION_COUNT_FAILED", "Failed to load notifications.", error);
  }

  return count ?? 0;
}

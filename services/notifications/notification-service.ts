import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { ServiceError } from "@/services/base";

type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];

export type NotificationType =
  | "order_placed"
  | "order_confirmed"
  | "order_processing"
  | "order_shipped"
  | "order_delivered"
  | "order_cancelled"
  | "admin_new_order"
  | "admin_inventory_alert";

/* ---------------------------------------------------------------------------
 * Customer notifications
 * --------------------------------------------------------------------- */

/** List notifications for a user, newest first. */
export async function listNotifications(
  userId: string,
  options?: { unreadOnly?: boolean; limit?: number; offset?: number },
): Promise<NotificationRow[]> {
  const supabase = await createSupabaseClient();
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  let query = supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId);

  if (options?.unreadOnly) {
    query = query.eq("is_read", false);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new ServiceError("NOTIFICATIONS_READ_FAILED", "Failed to load notifications.", error);
  }

  return (data ?? []) as NotificationRow[];
}

/** Get the count of unread notifications for a user. */
export async function getUnreadCount(userId: string): Promise<number> {
  const supabase = await createSupabaseClient();

  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);

  if (error) {
    throw new ServiceError("NOTIFICATION_COUNT_FAILED", "Failed to load notification count.", error);
  }

  return count ?? 0;
}

/** Mark a single notification as read. */
export async function markAsRead(
  userId: string,
  notificationId: string,
): Promise<void> {
  const supabase = await createSupabaseClient();

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId)
    .eq("user_id", userId);

  if (error) {
    throw new ServiceError("NOTIFICATION_UPDATE_FAILED", "Failed to update notification.", error);
  }
}

/** Mark all notifications for a user as read. */
export async function markAllAsRead(userId: string): Promise<void> {
  const supabase = await createSupabaseClient();

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false);

  if (error) {
    throw new ServiceError("NOTIFICATION_UPDATE_FAILED", "Failed to update notifications.", error);
  }
}

/* ---------------------------------------------------------------------------
 * Notification creation (used by order service and admin)
 * --------------------------------------------------------------------- */

type CreateNotificationInput = {
  userId: string;
  orderId?: string;
  type: NotificationType;
  title: string;
  message: string;
};

/** Create a single notification. Uses the RLS-aware client. */
export async function createNotification(
  input: CreateNotificationInput,
): Promise<NotificationRow> {
  const supabase = await createSupabaseClient();

  const { data, error } = await supabase
    .from("notifications")
    .insert({
      user_id: input.userId,
      order_id: input.orderId ?? null,
      type: input.type,
      title: input.title,
      message: input.message,
    })
    .select("*")
    .single();

  if (error) {
    throw new ServiceError("NOTIFICATION_CREATE_FAILED", "Failed to create notification.", error);
  }

  return data as NotificationRow;
}

/** Create a notification using the admin client (bypasses RLS). */
export async function createNotificationAdmin(
  input: CreateNotificationInput,
): Promise<NotificationRow> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("notifications")
    .insert({
      user_id: input.userId,
      order_id: input.orderId ?? null,
      type: input.type,
      title: input.title,
      message: input.message,
    })
    .select("*")
    .single();

  if (error) {
    throw new ServiceError("NOTIFICATION_CREATE_FAILED", "Failed to create notification.", error);
  }

  return data as NotificationRow;
}

/* ---------------------------------------------------------------------------
 * Notification templates
 * --------------------------------------------------------------------- */

const STATUS_NOTIFICATIONS: Record<string, { type: NotificationType; title: string; message: (orderNumber: string) => string }> = {
  pending: {
    type: "order_placed",
    title: "Order Placed",
    message: (n) => `Your order ${n} has been placed successfully. We'll confirm it shortly.`,
  },
  confirmed: {
    type: "order_confirmed",
    title: "Order Confirmed",
    message: (n) => `Your order ${n} has been confirmed and is being prepared.`,
  },
  processing: {
    type: "order_processing",
    title: "Order Processing",
    message: (n) => `Your order ${n} is now being processed and prepared for shipment.`,
  },
  shipped: {
    type: "order_shipped",
    title: "Order Shipped",
    message: (n) => `Your order ${n} has been shipped and is on its way to you.`,
  },
  delivered: {
    type: "order_delivered",
    title: "Order Delivered",
    message: (n) => `Your order ${n} has been delivered. We hope you love your purchase!`,
  },
  cancelled: {
    type: "order_cancelled",
    title: "Order Cancelled",
    message: (n) => `Your order ${n} has been cancelled.`,
  },
};

/** Create the appropriate customer notification for a status change. */
export async function createOrderStatusNotification(
  userId: string,
  orderId: string,
  orderNumber: string,
  newStatus: string,
): Promise<void> {
  const template = STATUS_NOTIFICATIONS[newStatus];
  if (!template) return;

  await createNotification({
    userId,
    orderId,
    type: template.type,
    title: template.title,
    message: template.message(orderNumber),
  });
}

/** Create an admin notification for a new order. */
export async function createAdminNewOrderNotification(
  adminUserId: string,
  orderId: string,
  orderNumber: string,
  total: number,
): Promise<void> {
  await createNotification({
    userId: adminUserId,
    orderId,
    type: "admin_new_order",
    title: "New Order Received",
    message: `New order ${orderNumber} placed for ${total} PKR.`,
  });
}

/* ---------------------------------------------------------------------------
 * Admin low-stock alerts
 * --------------------------------------------------------------------- */

/**
 * Notify every admin of a low-stock condition. Uses the service-role client so
 * notifications are created even when the calling server session belongs to a
 * customer checkout process. Best-effort: failures are swallowed so business
 * operations never fail because a notification could not be written.
 */
export async function notifyAdminsOfLowStock(
  productName: string,
  productId?: string,
): Promise<void> {
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createAdminClient();

    const { data: admins } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "admin");

    if (!admins || admins.length === 0) return;

    const title = "Low stock";
    const message = productId
      ? `"${productName}" is low on stock. Review and restock soon.`
      : `A product is low on stock. Review and restock soon.`;

    for (const admin of admins) {
      try {
        await supabase.from("notifications").insert({
          user_id: admin.id,
          type: "admin_inventory_alert",
          title,
          message,
        });
      } catch {
        // Best-effort per admin
      }
    }
  } catch {
    // Best-effort — never fail a business operation for a notification.
  }
}

/**
 * Pure guard for the instant out-of-stock alert: true only when a stock change
 * moved a product INTO exactly 0 stock from a previously positive value. This
 * never fires on a low-stock (still positive) crossing and never on a zero →
 * zero edit.
 */
export function crossedToOutOfStock(
  prevStock: number,
  newStock: number,
): boolean {
  return newStock === 0 && prevStock > 0;
}

/** Notify every admin that a product just went out of stock (stock = 0). */
export async function notifyAdminsOfOutOfStock(
  productName: string,
  productId?: string,
  prevStock?: number,
): Promise<void> {
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createAdminClient();

    const { data: admins } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "admin");

    if (!admins || admins.length === 0) return;

    const title = "Out of stock";
    const message = productId
      ? `"${productName}" is now out of stock${prevStock !== undefined ? ` (was ${prevStock})` : ""}. Restock soon.`
      : `A product is now out of stock. Restock soon.`;

    for (const admin of admins) {
      try {
        await supabase.from("notifications").insert({
          user_id: admin.id,
          type: "admin_inventory_alert",
          title,
          message,
        });
      } catch {
        // Best-effort per admin
      }
    }
  } catch {
    // Best-effort — never fail a business operation for a notification.
  }
}

/**
 * Check whether a stock reduction crosses INTO the low-stock zone and, if so,
 * alert admins. prevStock is the stock before the reduction.
 */
export async function maybeAlertAdminOnStockCrossing(
  prevStock: number,
  newStock: number,
  lowStockThreshold: number,
  productName: string,
  productId?: string,
): Promise<void> {
  if (
    newStock <= lowStockThreshold &&
    prevStock > lowStockThreshold
  ) {
    await notifyAdminsOfLowStock(productName, productId).catch(() => {});
  }
}

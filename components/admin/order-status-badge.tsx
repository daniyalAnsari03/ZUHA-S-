import type { OrderStatus } from "@/lib/supabase/types";

/**
 * Shared admin status pill styles. Kept here so the admin dashboard,
 * analytics, orders, customers, and notifications pages render statuses the
 * same way.
 */
export const ORDER_STATUS_STYLES: Record<OrderStatus, string> = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-blue-100 text-blue-700",
  processing: "bg-indigo-100 text-indigo-700",
  shipped: "bg-purple-100 text-purple-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Order Placed",
  confirmed: "Order Confirmed",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export function OrderStatusBadge({
  status,
  className = "",
}: {
  status: OrderStatus;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ORDER_STATUS_STYLES[status] ?? "bg-gray-100 text-gray-700"} ${className}`}
    >
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}

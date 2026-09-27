import type { Metadata } from "next";
import Link from "next/link";
import { Bell } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { getAuthUser } from "@/lib/auth/session";
import { formatPrice } from "@/lib/storefront/format";
import { getAdminOrderDetail } from "@/services/orders/order-service";
import {
  getNotificationDetail,
  markAsRead,
} from "@/services/notifications/notification-service";

const TYPE_LABEL: Record<string, string> = {
  admin_new_order: "New Order",
  admin_inventory_alert: "Inventory",
  order_placed: "Order Placed",
  order_confirmed: "Order Confirmed",
  order_processing: "Order Processing",
  order_shipped: "Order Shipped",
  order_delivered: "Order Delivered",
  order_cancelled: "Order Cancelled",
  admin_approval_requested: "Approval Requested",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Order Placed",
  confirmed: "Order Confirmed",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-blue-100 text-blue-700",
  processing: "bg-indigo-100 text-indigo-700",
  shipped: "bg-purple-100 text-purple-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-PK", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const metadata: Metadata = {
  title: "Notification · Admin",
  robots: { index: false, follow: false },
};

export default async function AdminNotificationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") redirect("/login");

  const { id } = await params;

  let notification;
  try {
    notification = await getNotificationDetail(user.id, id);
  } catch {
    notFound();
  }
  if (!notification) notFound();

  // Mark as read when the admin views the detail (best-effort, non-blocking).
  if (!notification.is_read) {
    await markAsRead(user.id, id).catch(() => {});
    notification = { ...notification, is_read: true };
  }

  let orderSummary: {
    orderNumber: string;
    status: string;
    total: number;
    createdAt: string;
  } | null = null;

  if (notification.order_id) {
    try {
      const order = await getAdminOrderDetail(
        { id: user.id, role: "admin" },
        notification.order_id,
      );
      orderSummary = {
        orderNumber: order.order_number,
        status: order.status,
        total: order.total,
        createdAt: order.created_at,
      };
    } catch {
      // Order may have been removed or is no longer accessible.
      orderSummary = null;
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/admin/notifications"
          className="text-sm font-medium text-plum hover:text-plum-dark"
        >
          ← Notifications
        </Link>
        <h1 className="font-serif text-2xl text-charcoal">
          Notification Detail
        </h1>
      </div>

      <div className="mt-6 space-y-6">
        {/* Notification card */}
        <section className="rounded-xl border border-charcoal/10 bg-neutral-soft p-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center rounded-full bg-plum/10 px-3 py-1 text-xs font-medium text-plum">
              {TYPE_LABEL[notification.type] ?? "Notice"}
            </span>
            {!notification.is_read && (
              <span className="flex items-center gap-1 text-xs text-plum">
                <Bell className="h-3 w-3" aria-hidden="true" />
                Unread
              </span>
            )}
            <span className="ml-auto text-xs text-charcoal-muted">
              {timeAgo(notification.created_at)}
            </span>
          </div>
          <h2 className="mt-4 font-serif text-lg text-charcoal">
            {notification.title}
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-charcoal-muted">
            {notification.message}
          </p>
          <p className="mt-3 text-xs text-charcoal-muted">
            Received {formatDate(notification.created_at)}
          </p>
        </section>

        {/* Linked order summary */}
        {notification.order_id && orderSummary && (
          <section className="rounded-xl border border-charcoal/10 bg-neutral-soft p-6">
            <h3 className="font-serif text-base text-charcoal">Linked Order</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-charcoal-muted">Order</dt>
                <dd className="font-medium text-charcoal">
                  #{orderSummary.orderNumber}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-charcoal-muted">Status</dt>
                <dd>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLE[orderSummary.status] ?? "bg-gray-100 text-gray-700"}`}
                  >
                    {STATUS_LABEL[orderSummary.status] ?? orderSummary.status}
                  </span>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-charcoal-muted">Total</dt>
                <dd className="font-semibold text-plum">
                  {formatPrice(orderSummary.total)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-charcoal-muted">Date</dt>
                <dd className="text-charcoal">
                  {formatDate(orderSummary.createdAt)}
                </dd>
              </div>
            </dl>
            <Link
              href={`/admin/orders/${notification.order_id}`}
              className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-plum transition-colors hover:text-plum-dark"
            >
              View full order →
            </Link>
          </section>
        )}

        {notification.order_id && !orderSummary && (
          <section className="rounded-xl border border-charcoal/10 bg-neutral-soft p-6">
            <h3 className="font-serif text-base text-charcoal">Linked Order</h3>
            <p className="mt-3 text-sm text-charcoal-muted">
              The linked order is no longer available or could not be loaded.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}

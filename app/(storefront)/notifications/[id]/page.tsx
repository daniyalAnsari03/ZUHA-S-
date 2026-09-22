import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Container } from "@/components/ui/container";
import { getAuthUser } from "@/lib/auth/session";
import { formatPrice } from "@/lib/storefront/format";
import { getOrderDetail } from "@/services/orders/order-service";
import {
  getNotificationDetail,
  markAsRead,
} from "@/services/notifications/notification-service";

export const metadata: Metadata = {
  title: "Notification",
  robots: { index: false, follow: false },
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Order Placed",
  confirmed: "Order Confirmed",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-blue-100 text-blue-700",
  processing: "bg-indigo-100 text-indigo-700",
  shipped: "bg-purple-100 text-purple-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-PK", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function NotificationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const { id } = await params;

  let notification;
  try {
    notification = await getNotificationDetail(user.id, id);
  } catch {
    notFound();
  }
  if (!notification) notFound();

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
      const order = await getOrderDetail(user.id, notification.order_id);
      orderSummary = {
        orderNumber: order.order_number,
        status: order.status,
        total: order.total,
        createdAt: order.created_at,
      };
    } catch {
      orderSummary = null;
    }
  }

  return (
    <main className="flex-1 bg-ivory">
      <Container size="lg" className="py-10 sm:py-14">
        <p className="text-[11px] uppercase tracking-[0.32em] text-gold-muted">
          <Link href="/" className="transition-colors hover:text-plum">
            Home
          </Link>{" "}
          / Notification
        </p>

        <h1 className="mt-3 font-serif text-2xl text-charcoal sm:text-3xl">
          Notification
        </h1>

        <div className="mt-8 space-y-6">
          <section className="rounded-xl border border-charcoal/10 bg-neutral-soft p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-plum/10 px-3 py-1 text-xs font-medium text-plum">
                {notification.title}
              </span>
              <span className="ml-auto text-xs text-charcoal-muted">
                {formatDate(notification.created_at)}
              </span>
            </div>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-charcoal-muted sm:text-base">
              {notification.message}
            </p>
          </section>

          {notification.order_id && orderSummary && (
            <section className="rounded-xl border border-charcoal/10 bg-neutral-soft p-6 sm:p-8">
              <h2 className="font-serif text-lg text-charcoal">Linked Order</h2>
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
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[orderSummary.status] ?? "bg-gray-100 text-gray-700"}`}
                    >
                      {STATUS_LABELS[orderSummary.status] ?? orderSummary.status}
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
                href={`/orders/${notification.order_id}`}
                className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-plum transition-colors hover:text-plum-dark"
              >
                View order details →
              </Link>
            </section>
          )}

          {notification.order_id && !orderSummary && (
            <section className="rounded-xl border border-charcoal/10 bg-neutral-soft p-6 sm:p-8">
              <h2 className="font-serif text-lg text-charcoal">Linked Order</h2>
              <p className="mt-3 text-sm text-charcoal-muted">
                The linked order is no longer available.
              </p>
            </section>
          )}
        </div>
      </Container>
    </main>
  );
}
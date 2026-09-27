import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { redirect, notFound } from "next/navigation";

import { getAuthUser } from "@/lib/auth/session";
import { resolveImageUrl } from "@/lib/images";
import { formatPrice } from "@/lib/storefront/format";
import { getAdminOrderDetail } from "@/services/orders/order-service";
import { AdminOrderActions } from "./admin-order-actions";

export const metadata: Metadata = {
  title: "Order Detail · Admin",
  robots: { index: false, follow: false },
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-blue-100 text-blue-700",
  processing: "bg-indigo-100 text-indigo-700",
  shipped: "bg-purple-100 text-purple-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Order Placed",
  confirmed: "Order Confirmed",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
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

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") redirect("/login");

  const { id } = await params;

  let order;
  try {
    order = await getAdminOrderDetail({ id: user.id, role: user.role }, id);
  } catch {
    notFound();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/admin/orders"
          className="text-sm font-medium text-plum hover:text-plum-dark"
        >
          ← Orders
        </Link>
        <h1 className="font-serif text-2xl text-charcoal">
          Order {order.order_number}
        </h1>
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium capitalize ${STATUS_STYLES[order.status] ?? "bg-gray-100 text-gray-700"}`}
        >
          {STATUS_LABELS[order.status] ?? order.status}
        </span>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* Main content */}
        <div className="space-y-6">
          {/* Status update */}
          <AdminOrderActions orderId={order.id} currentStatus={order.status} />

          {/* Order items */}
          <section className="rounded-xl border border-charcoal/10 bg-neutral-soft p-6">
            <h2 className="font-serif text-lg text-charcoal">Items</h2>
            <ul className="mt-4 divide-y divide-charcoal/5">
              {order.items.map((item) => (
                <li
                  key={item.id}
                  className="flex gap-4 py-4 first:pt-0 last:pb-0"
                >
                  <div className="h-20 w-16 shrink-0 overflow-hidden rounded-lg border border-charcoal/10 bg-cream">
                    {item.product_image ? (
                      <Image
                        src={resolveImageUrl(item.product_image) ?? ""}
                        alt={item.product_name}
                        width={128}
                        height={160}
                        sizes="80px"
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col justify-between">
                    <div>
                      <p className="font-serif text-sm text-charcoal">
                        {item.product_name}
                      </p>
                      <p className="mt-0.5 text-xs text-charcoal-muted">
                        Qty: {item.quantity} &times;{" "}
                        {formatPrice(item.product_price)}
                      </p>
                    </div>
                    <p className="text-sm font-medium text-charcoal">
                      {formatPrice(item.subtotal)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* Status history */}
          {order.history.length > 0 && (
            <section className="rounded-xl border border-charcoal/10 bg-neutral-soft p-6">
              <h2 className="font-serif text-lg text-charcoal">
                Status History
              </h2>
              <ul className="mt-4 space-y-4">
                {order.history.map((h) => (
                  <li key={h.id} className="flex gap-3">
                    <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-plum" />
                    <div>
                      <p className="text-sm font-medium text-charcoal">
                        {STATUS_LABELS[h.new_status] ?? h.new_status}
                        {h.previous_status
                          ? ` (from ${STATUS_LABELS[h.previous_status] ?? h.previous_status})`
                          : ""}
                      </p>
                      {h.note ? (
                        <p className="mt-0.5 text-xs text-charcoal-muted">
                          {h.note}
                        </p>
                      ) : null}
                      <p className="mt-0.5 text-xs text-charcoal-muted">
                        {formatDate(h.created_at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Order summary */}
          <section className="rounded-xl border border-charcoal/10 bg-neutral-soft p-6">
            <h2 className="font-serif text-lg text-charcoal">Order Summary</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-charcoal-muted">Subtotal</dt>
                <dd className="font-medium text-charcoal">
                  {formatPrice(order.subtotal)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-charcoal-muted">Shipping</dt>
                <dd className="font-medium text-charcoal">
                  {order.shipping_fee === 0
                    ? "Free"
                    : formatPrice(order.shipping_fee)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-charcoal/10 pt-2">
                <dt className="font-medium text-charcoal">Total</dt>
                <dd className="font-semibold text-plum">
                  {formatPrice(order.total)}
                </dd>
              </div>
            </dl>
          </section>

          {/* Customer info */}
          <section className="rounded-xl border border-charcoal/10 bg-neutral-soft p-6">
            <h2 className="font-serif text-lg text-charcoal">Customer</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-charcoal-muted">
                  Name
                </dt>
                <dd className="mt-0.5 text-charcoal">
                  <Link
                    href={`/admin/customers/${order.user_id}`}
                    className="font-medium text-plum transition-colors hover:text-plum-dark"
                  >
                    {order.customer_name}
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-charcoal-muted">
                  Phone
                </dt>
                <dd className="mt-0.5 text-charcoal">{order.customer_phone}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-charcoal-muted">
                  Email
                </dt>
                <dd className="mt-0.5 text-charcoal">{order.customer_email}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-charcoal-muted">
                  Address
                </dt>
                <dd className="mt-0.5 text-charcoal">
                  {order.shipping_address}
                  {order.city ? `, ${order.city}` : ""}
                  {order.postal_code ? ` ${order.postal_code}` : ""}
                </dd>
              </div>
              {order.payment_method ? (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-charcoal-muted">
                    Payment
                  </dt>
                  <dd className="mt-0.5 capitalize text-charcoal">
                    {order.payment_method}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="text-xs uppercase tracking-wide text-charcoal-muted">
                  Payment Status
                </dt>
                <dd className="mt-0.5 capitalize text-charcoal">
                  {order.payment_status}
                </dd>
              </div>
              {order.order_notes ? (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-charcoal-muted">
                    Notes
                  </dt>
                  <dd className="mt-0.5 text-charcoal">{order.order_notes}</dd>
                </div>
              ) : null}
            </dl>
            <Link
              href={`/admin/customers/${order.user_id}`}
              className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-plum transition-colors hover:text-plum-dark"
            >
              View customer profile →
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}

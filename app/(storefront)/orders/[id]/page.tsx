import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { redirect, notFound } from "next/navigation";

import { Container } from "@/components/ui/container";
import { getAuthUser } from "@/lib/auth/session";
import { resolveImageUrl } from "@/lib/images";
import { formatPrice } from "@/lib/storefront/format";
import { getOrderDetail } from "@/services/orders/order-service";

export const metadata: Metadata = {
  title: "Order Details",
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

const STATUS_FLOW = ["pending", "confirmed", "processing", "shipped", "delivered"];

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-PK", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const { id } = await params;

  let order;
  try {
    order = await getOrderDetail(user.id, id);
  } catch {
    notFound();
  }

  const currentStep = STATUS_FLOW.indexOf(order.status);
  const isCancelled = order.status === "cancelled";

  return (
    <main className="flex-1 bg-ivory">
      <Container size="lg" className="py-10 sm:py-14">
        <p className="text-[11px] uppercase tracking-[0.32em] text-gold-muted">
          <Link href="/" className="transition-colors hover:text-plum">
            Home
          </Link>{" "}
          /{" "}
          <Link href="/orders" className="transition-colors hover:text-plum">
            My Orders
          </Link>{" "}
          / Order Detail
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="font-serif text-2xl text-charcoal sm:text-3xl">
            Order {order.order_number}
          </h1>
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium capitalize ${STATUS_STYLES[order.status] ?? "bg-gray-100 text-gray-700"}`}
          >
            {STATUS_LABELS[order.status] ?? order.status}
          </span>
        </div>

        <p className="mt-1 text-sm text-charcoal-muted">
          Placed on {formatDate(order.created_at)}
        </p>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
          {/* Main content */}
          <div className="space-y-8">
            {/* Order progress */}
            {!isCancelled && (
              <section className="rounded-xl border border-charcoal/10 bg-white p-6">
                <h2 className="font-serif text-lg text-charcoal">Order Progress</h2>
                <div className="mt-5 flex items-center justify-between">
                  {STATUS_FLOW.map((step, i) => {
                    const isActive = i <= currentStep;
                    const isCurrent = i === currentStep;
                    return (
                      <div key={step} className="flex flex-1 items-center">
                        <div className="flex flex-col items-center">
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium ${
                              isActive
                                ? "bg-plum text-white"
                                : "border border-charcoal/20 bg-white text-charcoal-muted"
                            } ${isCurrent ? "ring-2 ring-plum/30" : ""}`}
                          >
                            {isActive && i < currentStep ? (
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              i + 1
                            )}
                          </div>
                          <span className="mt-1.5 text-[10px] font-medium capitalize text-charcoal-muted">
                            {STATUS_LABELS[step]}
                          </span>
                        </div>
                        {i < STATUS_FLOW.length - 1 && (
                          <div
                            className={`mx-1 h-0.5 flex-1 ${
                              i < currentStep ? "bg-plum" : "bg-charcoal/10"
                            }`}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {isCancelled && (
              <section className="rounded-xl border border-red-200 bg-red-50 p-6">
                <h2 className="font-serif text-lg text-red-700">Order Cancelled</h2>
                <p className="mt-2 text-sm text-red-600">
                  This order has been cancelled.
                  {order.history[0]?.note ? ` ${order.history[0].note}` : ""}
                </p>
              </section>
            )}

            {/* Order items */}
            <section className="rounded-xl border border-charcoal/10 bg-white p-6">
              <h2 className="font-serif text-lg text-charcoal">Items</h2>
              <ul className="mt-4 divide-y divide-charcoal/5">
                {order.items.map((item) => (
                  <li key={item.id} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                    <div className="h-20 w-16 shrink-0 overflow-hidden rounded-lg border border-charcoal/10 bg-cream">
                      {item.product_image ? (
                        <Image
                          src={resolveImageUrl(item.product_image) ?? ""}
                          alt={item.product_name}
                          width={128}
                          height={160}
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
                          Qty: {item.quantity} &times; {formatPrice(item.product_price)}
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
              <section className="rounded-xl border border-charcoal/10 bg-white p-6">
                <h2 className="font-serif text-lg text-charcoal">Status History</h2>
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
                          <p className="mt-0.5 text-xs text-charcoal-muted">{h.note}</p>
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
            <section className="rounded-xl border border-charcoal/10 bg-white p-6">
              <h2 className="font-serif text-lg text-charcoal">Order Summary</h2>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-charcoal-muted">Subtotal</dt>
                  <dd className="font-medium text-charcoal">{formatPrice(order.subtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-charcoal-muted">Shipping</dt>
                  <dd className="font-medium text-charcoal">
                    {order.shipping_fee === 0 ? "Free" : formatPrice(order.shipping_fee)}
                  </dd>
                </div>
                <div className="flex justify-between border-t border-charcoal/10 pt-2">
                  <dt className="font-medium text-charcoal">Total</dt>
                  <dd className="font-semibold text-plum">{formatPrice(order.total)}</dd>
                </div>
              </dl>
            </section>

            {/* Shipping info */}
            <section className="rounded-xl border border-charcoal/10 bg-white p-6">
              <h2 className="font-serif text-lg text-charcoal">Shipping Details</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-charcoal-muted">Name</dt>
                  <dd className="mt-0.5 text-charcoal">{order.customer_name}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-charcoal-muted">Phone</dt>
                  <dd className="mt-0.5 text-charcoal">{order.customer_phone}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-charcoal-muted">Email</dt>
                  <dd className="mt-0.5 text-charcoal">{order.customer_email}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-charcoal-muted">Address</dt>
                  <dd className="mt-0.5 text-charcoal">
                    {order.shipping_address}
                    {order.city ? `, ${order.city}` : ""}
                    {order.postal_code ? ` ${order.postal_code}` : ""}
                  </dd>
                </div>
                {order.payment_method ? (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-charcoal-muted">Payment</dt>
                    <dd className="mt-0.5 capitalize text-charcoal">{order.payment_method}</dd>
                  </div>
                ) : null}
                {order.order_notes ? (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-charcoal-muted">Notes</dt>
                    <dd className="mt-0.5 text-charcoal">{order.order_notes}</dd>
                  </div>
                ) : null}
              </dl>
            </section>

            <Link
              href="/orders"
              className="block text-center text-sm font-medium text-plum hover:text-plum-dark"
            >
              ← Back to My Orders
            </Link>
          </div>
        </div>
      </Container>
    </main>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";

import { Container } from "@/components/ui/container";
import { getAuthUser } from "@/lib/auth/session";
import { resolveImageUrl } from "@/lib/images";
import { formatPrice } from "@/lib/storefront/format";
import { getOrderDetailAction } from "@/app/storefront/actions";

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

const STATUS_STEPS: { status: string; label: string }[] = [
  { status: "pending", label: "Placed" },
  { status: "confirmed", label: "Confirmed" },
  { status: "processing", label: "Processing" },
  { status: "shipped", label: "Shipped" },
  { status: "delivered", label: "Delivered" },
];

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-PK", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-PK", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusIndex(currentStatus: string): number {
  return STATUS_STEPS.findIndex((s) => s.status === currentStatus);
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const result = await getOrderDetailAction(id);

  if (!result.ok) {
    notFound();
  }

  const order = result.order;
  const currentStatusIndex = getStatusIndex(order.status);

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
          / {order.order_number}
        </p>

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-serif text-2xl text-charcoal sm:text-3xl">
              Order {order.order_number}
            </h1>
            <div className="mt-2 flex items-center gap-3">
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium capitalize ${
                  STATUS_STYLES[order.status] ?? "bg-gray-100 text-gray-700"
                }`}
              >
                {order.status}
              </span>
              <p className="text-sm text-charcoal-muted">
                Placed {formatDate(order.created_at)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 sm:ml-auto">
            <Link
              href="/orders"
              className="rounded-lg border border-charcoal/20 bg-transparent px-5 py-2.5 text-sm font-medium tracking-wide text-charcoal transition-colors hover:border-plum hover:text-plum"
            >
              Back to Orders
            </Link>
          </div>
        </div>

        {/* Status Timeline */}
        <div className="mt-8 rounded-xl border border-charcoal/10 bg-neutral-soft p-6 sm:p-8">
          <h2 className="font-serif text-lg text-charcoal">
            Order Progress
          </h2>
          <div className="mt-6 relative">
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-charcoal/10 sm:left-8" />
            <div className="space-y-6">
              {STATUS_STEPS.map((step, index) => {
                const isCompleted = index <= currentStatusIndex;
                const isCurrent = index === currentStatusIndex && order.status !== "cancelled";
                return (
                  <div key={step.status} className="relative flex gap-4 pl-10 sm:pl-16">
                    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-all">
                      {isCompleted ? (
                        <div className="flex h-full w-full items-center justify-center rounded-full bg-plum">
                          <svg
                            className="h-5 w-5 text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2.5}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </div>
                      ) : isCurrent ? (
                        <div className="flex h-full w-full items-center justify-center rounded-full bg-white ring-2 ring-plum ring-offset-2">
                          <div className="h-3 w-3 rounded-full bg-plum animate-pulse" />
                        </div>
                      ) : (
                        <div className="flex h-full w-full items-center justify-center rounded-full bg-white border-charcoal/20" />
                      )}
                    </div>
                    <div className="flex flex-col justify-center min-w-0">
                      <p
                        className={`font-medium text-sm ${
                          isCompleted || isCurrent ? "text-charcoal" : "text-charcoal-muted"
                        }`}
                      >
                        {step.label}
                      </p>
                      {index < order.history.length && (
                        <p className="mt-0.5 text-xs text-charcoal-muted">
                          {formatDateTime(order.history[index].created_at)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
              {order.status === "cancelled" && (
                <div className="relative flex gap-4 pl-10 sm:pl-16">
                  <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 bg-white border-red-300">
                    <div className="h-3 w-3 rounded-full bg-red-400" />
                  </div>
                  <div className="flex flex-col justify-center">
                    <p className="font-medium text-sm text-red-600">Cancelled</p>
                    {order.history.length > 0 && (
                      <p className="mt-0.5 text-xs text-charcoal-muted">
                        {formatDateTime(order.history[0].created_at)}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-8 sm:grid-cols-3">
          {/* Order Items */}
          <div className="sm:col-span-2 space-y-6">
            <h2 className="font-serif text-lg text-charcoal">Order Items</h2>
            <ul className="divide-y divide-charcoal/5 overflow-hidden rounded-xl border border-charcoal/10 bg-neutral-soft">
              {order.items.map((item) => (
                <li key={item.id} className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                  <div className="flex min-w-0 flex-1 gap-4">
                    {item.product_image ? (
                      <div className="h-16 w-14 shrink-0 overflow-hidden rounded-lg border border-charcoal/10 bg-cream">
                        <Image
                          src={resolveImageUrl(item.product_image) ?? ""}
                          alt={item.product_name}
                          width={112}
                          height={128}
                          sizes="56px"
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-charcoal truncate">
                        {item.product_name}
                      </p>
                      <p className="mt-1 text-sm text-charcoal-muted">
                        Qty: {item.quantity} &middot; {formatPrice(item.product_price)} each
                      </p>
                    </div>
                  </div>
                  <p className="text-sm font-medium text-charcoal sm:text-right">
                    {formatPrice(item.subtotal)}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          {/* Order Summary */}
          <div className="rounded-xl border border-charcoal/10 bg-neutral-soft p-6">
            <h2 className="font-serif text-lg text-charcoal">Order Summary</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-charcoal-muted">Subtotal</dt>
                <dd className="font-medium text-charcoal">{formatPrice(order.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-charcoal-muted">Shipping</dt>
                <dd className="font-medium text-charcoal">{formatPrice(order.shipping_fee)}</dd>
              </div>
              {order.order_notes && (
                <div className="pt-3 border-t border-charcoal/10">
                  <dt className="text-charcoal-muted">Notes</dt>
                  <dd className="mt-1 text-charcoal">{order.order_notes}</dd>
                </div>
              )}
              <div className="pt-3 border-t border-charcoal/10 flex justify-between">
                <dt className="font-medium text-charcoal">Total</dt>
                <dd className="font-semibold text-charcoal">{formatPrice(order.total)}</dd>
              </div>
            </dl>

            <div className="mt-6 rounded-lg border border-charcoal/10 bg-white p-4">
              <h3 className="font-medium text-sm text-charcoal">Shipping Address</h3>
              <address className="mt-2 text-sm text-charcoal-muted not-italic">
                <p>{order.customer_name}</p>
                <p>{order.customer_phone}</p>
                <p>{order.customer_email}</p>
                <p className="mt-1">
                  {order.shipping_address}{" "}
                  {order.city && `, ${order.city}`}
                  {order.postal_code && `, ${order.postal_code}`}
                </p>
              </address>
            </div>

            <div className="mt-6 rounded-lg border border-charcoal/10 bg-white p-4">
              <h3 className="font-medium text-sm text-charcoal">Payment</h3>
              <dl className="mt-2 space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-charcoal-muted">Method</dt>
                  <dd className="font-medium text-charcoal capitalize">
                    {order.payment_method}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-charcoal-muted">Status</dt>
                  <dd className="font-medium text-charcoal capitalize">
                    {order.payment_status}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </Container>
    </main>
  );
}
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, DollarSign, ShoppingBag, User } from "lucide-react";

import { OrderStatusBadge } from "@/components/admin/order-status-badge";
import { getAuthUser } from "@/lib/auth/session";
import { formatPrice } from "@/lib/storefront/format";
import { getCustomerDetail } from "@/services/customers/customers-service";

export const metadata: Metadata = {
  title: "Customer · Admin",
  robots: { index: false, follow: false },
};

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 }).format(
    value,
  );
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-PK", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") redirect("/login");

  const { id } = await params;

  let detail;
  try {
    detail = await getCustomerDetail({ id: user.id, role: user.role }, id);
  } catch (error) {
    console.error("[admin] customer detail load failed:", error);
    detail = null;
  }

  if (!detail) notFound();

  const { profile, orders } = detail;

  return (
    <div>
      <Link
        href="/admin/customers"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-charcoal-muted transition-colors hover:text-plum"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        All customers
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-plum/10">
            <User className="h-6 w-6 text-plum" aria-hidden="true" />
          </div>
          <div>
            <h1 className="font-serif text-3xl text-charcoal">
              {profile.full_name ?? "Unnamed customer"}
            </h1>
            <p className="mt-0.5 text-sm text-charcoal-muted">
              {[profile.phone, profile.city].filter(Boolean).join(" · ") ||
                "No contact information on file"}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-charcoal/10 bg-neutral-soft p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-charcoal-muted">
              Orders
            </p>
            <ShoppingBag className="h-4 w-4 text-plum-light" aria-hidden="true" />
          </div>
          <p className="mt-3 font-serif text-2xl text-charcoal">
            {formatCount(detail.activeOrderCount)}
            <span className="text-sm text-charcoal-muted"> / {formatCount(detail.orderCount)}</span>
          </p>
          <p className="mt-1 text-xs text-charcoal-muted">active / total</p>
        </div>
        <div className="rounded-2xl border border-charcoal/10 bg-neutral-soft p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-charcoal-muted">
              Total spend
            </p>
            <DollarSign className="h-4 w-4 text-plum-light" aria-hidden="true" />
          </div>
          <p className="mt-3 font-serif text-2xl text-charcoal">
            {formatPrice(Math.round(detail.totalSpend))}
          </p>
          <p className="mt-1 text-xs text-charcoal-muted">excludes cancelled / refunded</p>
        </div>
        <div className="rounded-2xl border border-charcoal/10 bg-neutral-soft p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-charcoal-muted">
              Member since
            </p>
            <User className="h-4 w-4 text-plum-light" aria-hidden="true" />
          </div>
          <p className="mt-3 font-serif text-2xl text-charcoal">
            {new Date(profile.created_at).getFullYear()}
          </p>
          <p className="mt-1 text-xs text-charcoal-muted">
            {formatDate(profile.created_at)}
          </p>
        </div>
      </div>

      <section className="mt-10">
        <h2 className="font-serif text-xl text-charcoal">Order history</h2>
        {orders.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-charcoal/10 bg-neutral-soft px-5 py-8 text-center text-sm text-charcoal-muted">
            This customer has not placed any orders yet.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-charcoal/10 bg-neutral-soft">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-charcoal/10 bg-cream/40">
                  <th className="px-5 py-3 font-medium text-charcoal-muted">Order</th>
                  <th className="px-5 py-3 font-medium text-charcoal-muted">Total</th>
                  <th className="px-5 py-3 font-medium text-charcoal-muted">Status</th>
                  <th className="px-5 py-3 font-medium text-charcoal-muted">Payment</th>
                  <th className="px-5 py-3 font-medium text-charcoal-muted">Date</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal/5">
                {orders.map((order) => (
                  <tr key={order.id} className="transition-colors hover:bg-cream/30">
                    <td className="px-5 py-3.5">
                      <p className="font-mono text-xs font-medium text-charcoal">
                        {order.order_number}
                      </p>
                    </td>
                    <td className="px-5 py-3.5 font-medium text-charcoal">
                      {formatPrice(order.total)}
                    </td>
                    <td className="px-5 py-3.5">
                      <OrderStatusBadge status={order.status} />
                    </td>
                    <td className="px-5 py-3.5 capitalize text-charcoal-muted">
                      {order.payment_status.replace("_", " ")}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-charcoal-muted">
                      {formatDate(order.created_at)}
                    </td>
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="text-xs font-medium text-plum hover:text-plum-dark"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
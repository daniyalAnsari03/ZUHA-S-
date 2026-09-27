import Link from "next/link";
import {
  Banknote,
  Box,
  Boxes,
  Package,
  ShoppingBag,
  TrendingDown,
  Users,
} from "lucide-react";

import { OrderStatusBadge } from "@/components/admin/order-status-badge";
import { formatPrice } from "@/lib/storefront/format";
import type { DashboardData } from "@/services/analytics/analytics-service";

/** Placeholder shown while the streamed overview is still resolving. */
export function AdminOverviewSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading dashboard">
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="min-w-0 rounded-2xl border border-charcoal/10 bg-neutral-soft p-5"
          >
            <div className="flex items-center justify-between">
              <Box className="h-4 w-4 animate-pulse text-charcoal-muted/30" aria-hidden="true" />
            </div>
            <div className="mt-3 h-7 w-24 animate-pulse rounded bg-charcoal/8" />
            <div className="mt-2 h-3 w-32 animate-pulse rounded bg-charcoal/8" />
          </div>
        ))}
      </div>
      <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="min-w-0 rounded-2xl border border-charcoal/10 bg-neutral-soft p-6">
          <div className="h-6 w-32 animate-pulse rounded bg-charcoal/8" />
          <div className="mt-4 space-y-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-4 animate-pulse rounded bg-charcoal/8" />
            ))}
          </div>
        </div>
        <div className="min-w-0 rounded-2xl border border-charcoal/10 bg-neutral-soft p-6">
          <div className="h-6 w-32 animate-pulse rounded bg-charcoal/8" />
          <div className="mt-4 space-y-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-4 animate-pulse rounded bg-charcoal/8" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 }).format(
    value,
  );
}

type AdminOverviewProps = {
  dashboard: DashboardData;
  email: string | null;
};

/**
 * Rendered once the streamed dashboard data has resolved. Purely presentational
 * so the data fetch can stream in independently of the page shell.
 */
export function AdminOverview({ dashboard, email }: AdminOverviewProps) {
  const stats = [
    {
      label: "Revenue",
      value: formatPrice(Math.round(dashboard.revenue)),
      hint: "non-cancelled, paid orders",
      href: "/admin/analytics",
      icon: Banknote,
    },
    {
      label: "Orders",
      value: formatCount(dashboard.activeOrderCount),
      hint: `${formatCount(dashboard.ordersCount)} total · 6 statuses`,
      href: "/admin/orders",
      icon: ShoppingBag,
    },
    {
      label: "Customers",
      value: formatCount(dashboard.customersCount),
      hint: "registered customers",
      href: "/admin/customers",
      icon: Users,
    },
    {
      label: "Products",
      value: formatCount(dashboard.activeProductsCount),
      hint: `${formatCount(dashboard.productsCount)} total`,
      href: "/admin/products",
      icon: Package,
    },
  ];

  return (
    <>
      <p className="mt-1 text-sm text-charcoal-muted">
        Signed in as {email ?? "admin"}.
      </p>
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="min-w-0 rounded-2xl border border-charcoal/10 bg-neutral-soft p-5 transition-colors hover:border-plum/30"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-charcoal-muted">
                {stat.label}
              </p>
              <stat.icon className="h-4 w-4 text-plum-light" aria-hidden="true" />
            </div>
            <p className="mt-3 font-serif text-2xl text-charcoal">{stat.value}</p>
            <p className="mt-1 text-xs text-charcoal-muted">{stat.hint}</p>
          </Link>
        ))}
      </div>

      <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Order status distribution */}
        <section className="min-w-0 rounded-2xl border border-charcoal/10 bg-neutral-soft p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg text-charcoal">Order status</h2>
            <Link
              href="/admin/orders"
              className="text-xs font-medium text-plum hover:text-plum-dark"
            >
              View all orders
            </Link>
          </div>
          {dashboard.statusDistribution.every((s) => s.count === 0) ? (
            <p className="mt-4 text-sm text-charcoal-muted">
              No orders yet — new orders will appear here.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-charcoal/5">
              {dashboard.statusDistribution.map((item) => {
                const pct =
                  dashboard.ordersCount > 0
                    ? Math.round((item.count / dashboard.ordersCount) * 100)
                    : 0;
                return (
                  <li
                    key={item.status}
                    className="flex items-center gap-3 py-2.5 sm:gap-4"
                  >
                    <span className="w-28 shrink-0 truncate text-sm font-medium text-charcoal sm:w-32">
                      {item.label}
                    </span>
                    <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-ivory">
                      <div
                        className="h-full rounded-full bg-plum"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right text-sm tabular-nums text-charcoal-muted">
                      {item.count}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Recent orders */}
        <section className="min-w-0 rounded-2xl border border-charcoal/10 bg-neutral-soft p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg text-charcoal">Recent orders</h2>
            <Link
              href="/admin/orders"
              className="text-xs font-medium text-plum hover:text-plum-dark"
            >
              View all orders
            </Link>
          </div>
          {dashboard.recentOrders.length === 0 ? (
            <p className="mt-4 text-sm text-charcoal-muted">
              No orders have been placed yet.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-charcoal/5">
              {dashboard.recentOrders.map((order) => (
                <li key={order.id}>
                  <Link
                    href={`/admin/orders/${order.id}`}
                    className="flex items-center justify-between gap-3 py-2.5 transition-colors hover:bg-cream/50 sm:gap-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs font-medium text-charcoal">
                        {order.orderNumber}
                      </p>
                      <p className="truncate text-sm text-charcoal-muted">
                        {order.customerName}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
                      <span className="whitespace-nowrap text-sm font-medium text-charcoal">
                        {formatPrice(order.total)}
                      </span>
                      <OrderStatusBadge status={order.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Low stock */}
      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-serif text-xl text-charcoal">
            <Boxes className="h-5 w-5 text-plum" aria-hidden="true" />
            Needs attention
          </h2>
          <Link
            href="/admin/inventory"
            className="text-sm font-medium text-plum hover:text-plum-dark"
          >
            Open inventory
          </Link>
        </div>

        {dashboard.lowStockProducts.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-charcoal/10 bg-neutral-soft px-5 py-8 text-center text-sm text-charcoal-muted">
            No low-stock products — inventory is healthy.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-charcoal/5 overflow-hidden rounded-2xl border border-charcoal/10 bg-neutral-soft">
            {dashboard.lowStockProducts.slice(0, 5).map((product) => (
              <li key={product.id}>
                <Link
                  href={`/admin/products/${product.id}/edit`}
                  className="flex items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-cream/60 sm:gap-4"
                >
                  <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-charcoal">
                    <TrendingDown
                      className="h-4 w-4 shrink-0 text-amber-600"
                      aria-hidden="true"
                    />
                    <span className="truncate">{product.name}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1 text-sm text-charcoal-muted sm:flex-row sm:items-center sm:gap-3">
                    <span className="whitespace-nowrap">
                      {product.stockQuantity} left · {formatPrice(product.price)}
                    </span>
                    <span
                      className={
                        product.stockQuantity === 0
                          ? "rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700"
                          : "rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700"
                      }
                    >
                      {product.stockQuantity === 0 ? "Out of stock" : "Low stock"}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

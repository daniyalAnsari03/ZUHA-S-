import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowUpRight,
  Banknote,
  Boxes,
  Package,
  ShoppingBag,
  TrendingDown,
  Users,
} from "lucide-react";

import { OrderStatusBadge } from "@/components/admin/order-status-badge";
import { getAuthUser } from "@/lib/auth/session";
import { formatPrice } from "@/lib/storefront/format";
import { getAdminDashboard } from "@/services/analytics/analytics-service";

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 }).format(
    value,
  );
}

export default async function AdminOverviewPage() {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") redirect("/login");

  let dashboard;
  try {
    dashboard = await getAdminDashboard({
      id: user.id,
      role: user.role as "admin",
    });
  } catch (error) {
    dashboard = null;
    console.error("[admin] dashboard load failed:", error);
  }

  const stats = dashboard
    ? [
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
      ]
    : [];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-charcoal">Overview</h1>
          <p className="mt-1 text-sm text-charcoal-muted">
            Business snapshot · Signed in as {user?.email ?? "admin"}.
          </p>
        </div>
        <Link
          href="/admin/analytics"
          className="inline-flex items-center gap-1.5 rounded-full bg-plum px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-plum-dark"
        >
          Sales analytics
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      {!dashboard ? (
        <div className="mt-8 rounded-xl border border-charcoal/10 bg-neutral-soft p-10 text-center text-sm text-charcoal-muted">
          Dashboard could not be loaded right now. Please try again.
        </div>
      ) : (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <Link
                key={stat.label}
                href={stat.href}
                className="rounded-2xl border border-charcoal/10 bg-neutral-soft p-5 transition-colors hover:border-plum/30"
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

          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            {/* Order status distribution */}
            <section className="rounded-2xl border border-charcoal/10 bg-neutral-soft p-6">
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
                      <li key={item.status} className="flex items-center gap-3 py-2.5 sm:gap-4">
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
            <section className="rounded-2xl border border-charcoal/10 bg-neutral-soft p-6">
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
                        <TrendingDown className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                        <span className="truncate">{product.name}</span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1 text-sm text-charcoal-muted sm:flex-row sm:items-center sm:gap-3">
                        <span className="whitespace-nowrap">
                          {product.stockQuantity} left ·{" "}
                          {formatPrice(product.price)}
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
      )}
    </div>
  );
}
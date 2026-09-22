import Link from "next/link";
import { redirect } from "next/navigation";
import { Banknote, Package, ReceiptText, ShoppingBag } from "lucide-react";

import { OrderStatusBadge } from "@/components/admin/order-status-badge";
import { getAuthUser } from "@/lib/auth/session";
import { formatPrice } from "@/lib/storefront/format";
import { getSalesAnalytics } from "@/services/analytics/analytics-service";

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 }).format(
    value,
  );
}

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Analytics · Admin",
  robots: { index: false, follow: false },
};

export default async function AdminAnalyticsPage() {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") redirect("/login");

  let analytics;
  try {
    analytics = await getSalesAnalytics(
      { id: user.id, role: user.role as "admin" },
      { trendDays: 14 },
    );
  } catch (error) {
    analytics = null;
    console.error("[admin] analytics load failed:", error);
  }

  const kpis = analytics
    ? [
        {
          label: "Revenue",
          value: formatPrice(Math.round(analytics.revenue)),
          hint: "non-cancelled, paid orders",
          icon: Banknote,
          href: "/admin/orders",
        },
        {
          label: "Average order value",
          value: formatPrice(Math.round(analytics.averageOrderValue)),
          hint: "across active orders",
          icon: ReceiptText,
          href: "/admin/orders",
        },
        {
          label: "Active orders",
          value: formatCount(analytics.activeOrderCount),
          hint: `${formatCount(analytics.ordersCount)} total in the system`,
          icon: ShoppingBag,
          href: "/admin/orders",
        },
        {
          label: "Top product revenue",
          value:
            analytics.topProducts.length > 0
              ? formatPrice(Math.round(analytics.topProducts[0].revenue))
              : "—",
          hint:
            analytics.topProducts.length > 0
              ? analytics.topProducts[0].productName
              : "No sales yet",
          icon: Package,
          href: "/admin/products",
        },
      ]
    : [];

  const trendMax = analytics
    ? Math.max(...analytics.salesTrend.map((point) => point.revenue), 1)
    : 1;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-charcoal">Analytics</h1>
          <p className="mt-1 text-sm text-charcoal-muted">
            Sales performance for the last {analytics?.trendDays ?? "—"} days.
          </p>
        </div>
      </div>

      {!analytics ? (
        <div className="mt-8 rounded-xl border border-charcoal/10 bg-neutral-soft p-10 text-center text-sm text-charcoal-muted">
          Analytics could not be loaded right now. Please try again.
        </div>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {kpis.map((kpi) => (
              <Link
                key={kpi.label}
                href={kpi.href}
                className="min-w-0 rounded-2xl border border-charcoal/10 bg-neutral-soft p-5 transition-colors hover:border-plum/30"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-charcoal-muted">
                    {kpi.label}
                  </p>
                  <kpi.icon className="h-4 w-4 text-plum-light" aria-hidden="true" />
                </div>
                <p className="mt-3 font-serif text-2xl text-charcoal">{kpi.value}</p>
                <p className="mt-1 truncate text-xs text-charcoal-muted">{kpi.hint}</p>
              </Link>
            ))}
          </div>

          <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-5">
            {/* Sales trend */}
            <section className="min-w-0 rounded-2xl border border-charcoal/10 bg-neutral-soft p-6 lg:col-span-3">
              <h2 className="font-serif text-lg text-charcoal">Sales trend</h2>
              <p className="text-xs text-charcoal-muted">
                Daily revenue over the last {analytics.trendDays} days
              </p>
              <div className="mt-6 overflow-x-auto pb-1">
                <div className="flex h-48 min-w-full items-end gap-1.5">
                {analytics.salesTrend.map((point) => (
                  <div
                    key={point.dateKey}
                    className="group relative flex h-full flex-1 flex-col justify-end"
                  >
                    <div className="pointer-events-none absolute -top-1 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-charcoal px-2 py-1 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                      {formatPrice(Math.round(point.revenue))}
                    </div>
                    <div
                      className={
                        point.revenue > 0
                          ? "rounded-t bg-plum transition-colors hover:bg-plum-dark"
                          : "rounded-t bg-charcoal/10"
                      }
                      style={{
                        height: `${Math.max(
                          point.revenue > 0 ? 4 : 2,
                          (point.revenue / trendMax) * 100,
                        )}%`,
                      }}
                    />
                    <div className="mt-1.5 truncate text-center text-[9px] text-charcoal-muted">
                      {point.label}
                    </div>
                  </div>
                ))}
                </div>
              </div>
            </section>

            {/* Status distribution */}
            <section className="min-w-0 rounded-2xl border border-charcoal/10 bg-neutral-soft p-6 lg:col-span-2">
              <h2 className="font-serif text-lg text-charcoal">Order status</h2>
              <ul className="mt-4 divide-y divide-charcoal/5">
                {analytics.statusDistribution.map((item) => {
                  const pct =
                    analytics.ordersCount > 0
                      ? Math.round((item.count / analytics.ordersCount) * 100)
                      : 0;
                  return (
                    <li key={item.status} className="flex items-center gap-3 py-2.5 sm:gap-4">
                      <span className="w-24 shrink-0 truncate text-sm font-medium text-charcoal sm:w-28">
                        {item.label}
                      </span>
                      <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-ivory">
                        <div
                          className="h-full rounded-full bg-plum"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-6 shrink-0 text-right text-sm tabular-nums text-charcoal-muted">
                        {item.count}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>

          {/* Top products */}
          <section className="mt-10">
            <h2 className="font-serif text-xl text-charcoal">Top products</h2>
            {analytics.topProducts.length === 0 ? (
              <p className="mt-4 rounded-2xl border border-charcoal/10 bg-neutral-soft px-5 py-8 text-center text-sm text-charcoal-muted">
                No product sales yet — paid orders will appear here.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-xl border border-charcoal/10 bg-neutral-soft">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-charcoal/10 bg-cream/40">
                      <th className="px-5 py-3 font-medium text-charcoal-muted">Product</th>
                      <th className="px-5 py-3 font-medium text-charcoal-muted">Units sold</th>
                      <th className="px-5 py-3 font-medium text-charcoal-muted">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-charcoal/5">
                    {analytics.topProducts.map((product) => (
                      <tr key={`${product.productId ?? product.productName}`}>
                        <td className="px-5 py-3.5">
                          {product.productId ? (
                            <Link
                              href={`/admin/products/${product.productId}/edit`}
                              className="font-medium text-charcoal hover:text-plum"
                            >
                              {product.productName}
                            </Link>
                          ) : (
                            <span className="font-medium text-charcoal">
                              {product.productName}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 tabular-nums text-charcoal">
                          {product.unitsSold}
                        </td>
                        <td className="px-5 py-3.5 font-medium text-charcoal">
                          {formatPrice(Math.round(product.revenue))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="mt-10 rounded-2xl border border-charcoal/10 bg-cream/40 p-5">
            <h3 className="flex items-center gap-2 border-b border-charcoal/10 pb-3 font-serif text-base text-charcoal">
              <ShoppingBag className="h-4 w-4 text-plum" aria-hidden="true" />
              Recent orders
            </h3>
            <ul className="mt-3 divide-y divide-charcoal/5">
              {analytics.recentOrders.map((order) => (
                <li key={order.id}>
                  <Link
                    href={`/admin/orders/${order.id}`}
                    className="flex items-center justify-between gap-3 py-2.5 transition-colors hover:bg-cream sm:gap-4"
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
          </section>
        </>
      )}
    </div>
  );
}

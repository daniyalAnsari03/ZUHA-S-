import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Package } from "lucide-react";

import { getAuthUser } from "@/lib/auth/session";
import { formatPrice } from "@/lib/storefront/format";
import { listAllOrders } from "@/services/orders/order-service";

export const metadata: Metadata = {
  title: "Orders · Admin",
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

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-PK", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string; page?: string }>;
}) {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") redirect("/login");

  const params = await searchParams;
  const status = params.status as
    import("@/lib/supabase/types").OrderStatus | undefined;
  const search = params.search;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const perPage = 20;
  const offset = (page - 1) * perPage;

  let result;
  try {
    result = await listAllOrders(
      { id: user.id, role: user.role },
      { status, search, limit: perPage, offset },
    );
  } catch {
    result = { orders: [], total: 0 };
  }

  const totalPages = Math.max(1, Math.ceil(result.total / perPage));

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-charcoal">Orders</h1>
          <p className="mt-1 text-sm text-charcoal-muted">
            {result.total} order{result.total === 1 ? "" : "s"} total
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/admin/orders"
          className={`inline-flex min-h-11 items-center rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
            !status
              ? "bg-plum text-white"
              : "border border-charcoal/15 bg-neutral-soft text-charcoal hover:border-plum hover:text-plum"
          }`}
        >
          All
        </Link>
        {[
          "pending",
          "confirmed",
          "processing",
          "shipped",
          "delivered",
          "cancelled",
        ].map((s) => (
          <Link
            key={s}
            href={`/admin/orders?status=${s}`}
            className={`inline-flex min-h-11 items-center rounded-full px-4 py-1.5 text-xs font-medium capitalize transition-colors ${
              status === s
                ? "bg-plum text-white"
                : "border border-charcoal/15 bg-neutral-soft text-charcoal hover:border-plum hover:text-plum"
            }`}
          >
            {s}
          </Link>
        ))}
      </div>

      {/* Search */}
      <form className="mt-4" action="/admin/orders" method="get">
        {status ? <input type="hidden" name="status" value={status} /> : null}
        <div className="flex gap-2">
          <input
            type="text"
            name="search"
            defaultValue={search ?? ""}
            placeholder="Search by order number, name, or email…"
            className="flex-1 rounded-lg border border-charcoal/15 bg-ivory px-4 py-2.5 text-sm text-charcoal placeholder:text-charcoal-muted/60 focus:border-plum focus:outline-none focus:ring-2 focus:ring-plum/15"
          />
          <button
            type="submit"
            className="rounded-lg bg-plum px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-plum-dark"
          >
            Search
          </button>
        </div>
      </form>

      {/* Orders list */}
      {result.orders.length === 0 ? (
        <div className="mt-8 rounded-xl border border-charcoal/10 bg-neutral-soft p-10 text-center">
          <Package
            className="mx-auto h-10 w-10 text-charcoal-muted/40"
            aria-hidden="true"
          />
          <p className="mt-3 text-sm text-charcoal-muted">No orders found.</p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-charcoal/10 bg-neutral-soft">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-charcoal/10 bg-cream/40">
                  <th className="px-5 py-3 font-medium text-charcoal-muted">
                    Order
                  </th>
                  <th className="px-5 py-3 font-medium text-charcoal-muted">
                    Customer
                  </th>
                  <th className="px-5 py-3 font-medium text-charcoal-muted">
                    Items
                  </th>
                  <th className="px-5 py-3 font-medium text-charcoal-muted">
                    Total
                  </th>
                  <th className="px-5 py-3 font-medium text-charcoal-muted">
                    Status
                  </th>
                  <th className="px-5 py-3 font-medium text-charcoal-muted">
                    Date
                  </th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal/5">
                {result.orders.map((order) => (
                  <tr
                    key={order.id}
                    className="transition-colors hover:bg-cream/30"
                  >
                    <td className="px-5 py-3.5">
                      <p className="font-mono text-xs font-medium text-charcoal">
                        {order.order_number}
                      </p>
                    </td>
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/admin/customers/${order.user_id}`}
                        className="text-charcoal transition-colors hover:text-plum"
                      >
                        {order.customer_name}
                      </Link>
                      <p className="text-xs text-charcoal-muted">
                        {order.customer_email}
                      </p>
                    </td>
                    <td className="px-5 py-3.5 text-charcoal-muted">
                      {order.items.length}
                    </td>
                    <td className="px-5 py-3.5 font-medium text-charcoal">
                      {formatPrice(order.total)}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[order.status] ?? "bg-gray-100 text-gray-700"}`}
                      >
                        {order.status}
                      </span>
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-charcoal/10 px-5 py-3">
              <p className="text-xs text-charcoal-muted">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link
                    href={`/admin/orders?page=${page - 1}${status ? `&status=${status}` : ""}${search ? `&search=${encodeURIComponent(search)}` : ""}`}
                    className="rounded border border-charcoal/15 px-3 py-1.5 text-xs font-medium text-charcoal hover:border-plum hover:text-plum"
                  >
                    Previous
                  </Link>
                )}
                {page < totalPages && (
                  <Link
                    href={`/admin/orders?page=${page + 1}${status ? `&status=${status}` : ""}${search ? `&search=${encodeURIComponent(search)}` : ""}`}
                    className="rounded border border-charcoal/15 px-3 py-1.5 text-xs font-medium text-charcoal hover:border-plum hover:text-plum"
                  >
                    Next
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Search, Users } from "lucide-react";

import { getAuthUser } from "@/lib/auth/session";
import { formatPrice } from "@/lib/storefront/format";
import { listCustomers } from "@/services/customers/customers-service";

export const metadata: Metadata = {
  title: "Customers · Admin",
  robots: { index: false, follow: false },
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-PK", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") redirect("/login");

  const params = await searchParams;
  const search = params.search;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const perPage = 25;
  const offset = (page - 1) * perPage;

  let result;
  try {
    result = await listCustomers(
      { id: user.id, role: user.role },
      { search, limit: perPage, offset },
    );
  } catch (error) {
    result = { customers: [], total: 0 };
    console.error("[admin] customers load failed:", error);
  }

  const totalPages = Math.max(1, Math.ceil(result.total / perPage));

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-charcoal">Customers</h1>
          <p className="mt-1 text-sm text-charcoal-muted">
            {result.total} customer{result.total === 1 ? "" : "s"} total
          </p>
        </div>
      </div>

      <form className="mt-6" action="/admin/customers" method="get">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-muted/50"
              aria-hidden="true"
            />
            <input
              type="text"
              name="search"
              defaultValue={search ?? ""}
              placeholder="Search by name, phone, or city…"
              className="w-full rounded-lg border border-charcoal/15 bg-ivory py-2.5 pl-10 pr-4 text-sm text-charcoal placeholder:text-charcoal-muted/60 focus:border-plum focus:outline-none focus:ring-2 focus:ring-plum/15"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-plum px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-plum-dark"
          >
            Search
          </button>
        </div>
      </form>

      {result.customers.length === 0 ? (
        <div className="mt-8 rounded-xl border border-charcoal/10 bg-neutral-soft p-10 text-center">
          <Users
            className="mx-auto h-10 w-10 text-charcoal-muted/40"
            aria-hidden="true"
          />
          <p className="mt-3 text-sm text-charcoal-muted">
            {search ? "No customers match your search." : "No customers yet."}
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-charcoal/10 bg-neutral-soft">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-charcoal/10 bg-cream/40">
                  <th className="px-5 py-3 font-medium text-charcoal-muted">
                    Customer
                  </th>
                  <th className="px-5 py-3 font-medium text-charcoal-muted">
                    Orders
                  </th>
                  <th className="px-5 py-3 font-medium text-charcoal-muted">
                    Total spend
                  </th>
                  <th className="px-5 py-3 font-medium text-charcoal-muted">
                    Last order
                  </th>
                  <th className="px-5 py-3 font-medium text-charcoal-muted">
                    Joined
                  </th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal/5">
                {result.customers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="transition-colors hover:bg-cream/30"
                  >
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-charcoal">
                        {customer.fullName ?? "Unnamed customer"}
                      </p>
                      <p className="text-xs text-charcoal-muted">
                        {[customer.phone, customer.city]
                          .filter(Boolean)
                          .join(" · ") || "No contact info"}
                      </p>
                    </td>
                    <td className="px-5 py-3.5 tabular-nums text-charcoal-muted">
                      {customer.activeOrderCount}
                      <span className="text-xs"> / {customer.orderCount}</span>
                    </td>
                    <td className="px-5 py-3.5 font-medium text-charcoal">
                      {formatPrice(Math.round(customer.totalSpend))}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-charcoal-muted">
                      {formatDate(customer.lastOrderAt)}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-charcoal-muted">
                      {formatDate(customer.createdAt)}
                    </td>
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/admin/customers/${customer.id}`}
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

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-charcoal/10 px-5 py-3">
              <p className="text-xs text-charcoal-muted">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link
                    href={`/admin/customers?page=${page - 1}${search ? `&search=${encodeURIComponent(search)}` : ""}`}
                    className="rounded border border-charcoal/15 px-3 py-1.5 text-xs font-medium text-charcoal hover:border-plum hover:text-plum"
                  >
                    Previous
                  </Link>
                )}
                {page < totalPages && (
                  <Link
                    href={`/admin/customers?page=${page + 1}${search ? `&search=${encodeURIComponent(search)}` : ""}`}
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

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Boxes, Search } from "lucide-react";

import { StockAdjustDialog } from "@/app/admin/inventory/components/stock-adjust-dialog";
import { CategoryFilterSelect } from "@/app/admin/inventory/components/category-filter";
import { getAuthUser } from "@/lib/auth/session";
import { listAllCategories } from "@/services/categories/categories-service";
import { listPagedProducts } from "@/services/products/products-service";

export const metadata: Metadata = {
  title: "Inventory · Admin",
  robots: { index: false, follow: false },
};

export default async function AdminInventoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    category?: string;
    status?: string;
    page?: string;
  }>;
}) {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") redirect("/login");

  const params = await searchParams;
  const search = params.search;
  const category = params.category;
  const status = params.status;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const perPage = 20;
  const offset = (page - 1) * perPage;

  const [result, categories] = await Promise.all([
    listPagedProducts(
      { id: user.id, role: user.role },
      {
        search,
        categoryId: category,
        isActive: status === "archived" ? false : undefined,
        limit: perPage,
        offset,
      },
    ).catch(() => ({ products: [], total: 0 })),
    listAllCategories({ id: user.id, role: user.role }).catch(() => []),
  ]);

  const totalPages = Math.max(1, Math.ceil(result.total / perPage));

  const { products } = result;

  const filtered =
    status === "low" || status === "out"
      ? products.filter((p) =>
          status === "out"
            ? p.stock_quantity === 0 && p.is_active
            : p.is_active && p.stock_quantity <= p.low_stock_threshold,
        )
      : products;

  const lowStockCount = filtered.filter(
    (p) => p.is_active && p.stock_quantity <= p.low_stock_threshold,
  ).length;
  const outOfStockCount = filtered.filter(
    (p) => p.is_active && p.stock_quantity === 0,
  ).length;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-charcoal">Inventory</h1>
          <p className="mt-1 text-sm text-charcoal-muted">
            {result.total} products · {lowStockCount} low stock ·{" "}
            {outOfStockCount} out of stock
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link
          href="/admin/inventory"
          className={`inline-flex items-center rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
            !status
              ? "bg-plum text-white"
              : "border border-charcoal/15 bg-neutral-soft text-charcoal hover:border-plum hover:text-plum"
          }`}
        >
          All
        </Link>
        <Link
          href="/admin/inventory?status=low"
          className={`inline-flex items-center rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
            status === "low"
              ? "bg-plum text-white"
              : "border border-charcoal/15 bg-neutral-soft text-charcoal hover:border-plum hover:text-plum"
          }`}
        >
          Low stock
        </Link>
        <Link
          href="/admin/inventory?status=out"
          className={`inline-flex items-center rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
            status === "out"
              ? "bg-plum text-white"
              : "border border-charcoal/15 bg-neutral-soft text-charcoal hover:border-plum hover:text-plum"
          }`}
        >
          Out of stock
        </Link>

        <CategoryFilterSelect
          categories={categories}
          value={category ?? ""}
          search={search}
          status={status}
        />
      </div>

      {/* Search */}
      <form className="mt-4" action="/admin/inventory" method="get">
        {category ? <input type="hidden" name="category" value={category} /> : null}
        {status ? <input type="hidden" name="status" value={status} /> : null}
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
              placeholder="Search by name, SKU, or description…"
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

      {filtered.length === 0 ? (
        <div className="mt-8 rounded-xl border border-charcoal/10 bg-neutral-soft p-10 text-center">
          <Boxes className="mx-auto h-10 w-10 text-charcoal-muted/40" aria-hidden="true" />
          <p className="mt-3 text-sm text-charcoal-muted">
            No products match the current filters.
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-charcoal/10 bg-neutral-soft">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-charcoal/10 bg-cream/40">
                  <th className="px-5 py-3 font-medium text-charcoal-muted">Product</th>
                  <th className="px-5 py-3 font-medium text-charcoal-muted">SKU</th>
                  <th className="px-5 py-3 font-medium text-charcoal-muted">Category</th>
                  <th className="px-5 py-3 font-medium text-charcoal-muted">Stock</th>
                  <th className="px-5 py-3 font-medium text-charcoal-muted">Status</th>
                  <th className="px-5 py-3 text-right font-medium text-charcoal-muted">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal/5">
                {filtered.map((product) => {
                  const low = product.stock_quantity <= product.low_stock_threshold;
                  return (
                    <tr key={product.id} className="hover:bg-cream/30">
                      <td className="px-5 py-3.5">
                        <Link
                          href={`/admin/products/${product.id}/edit`}
                          className="font-medium text-charcoal hover:text-plum"
                        >
                          {product.name}
                        </Link>
                        <p className="text-xs text-charcoal-muted">
                          {product.is_active ? "Active" : "Archived"}
                        </p>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-charcoal-muted">
                        {product.sku || "—"}
                      </td>
                      <td className="px-5 py-3.5 text-charcoal-muted">
                        {product.category?.name ?? "Uncategorised"}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`font-medium tabular-nums ${
                            !product.is_active
                              ? "text-charcoal-muted"
                              : product.stock_quantity === 0
                                ? "text-red-600"
                                : low
                                  ? "text-amber-600"
                                  : "text-charcoal"
                          }`}
                        >
                          {product.stock_quantity}
                        </span>
                        <span className="text-xs text-charcoal-muted">
                          {" "}
                          / threshold {product.low_stock_threshold}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {!product.is_active ? (
                          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                            Archived
                          </span>
                        ) : product.stock_quantity === 0 ? (
                          <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                            Out of stock
                          </span>
                        ) : low ? (
                          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                            Low stock
                          </span>
                        ) : (
                          <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                            In stock
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <StockAdjustDialog
                          productId={product.id}
                          productName={product.name}
                          currentStock={product.stock_quantity}
                          currentThreshold={product.low_stock_threshold}
                        />
                      </td>
                    </tr>
                  );
                })}
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
                    href={`/admin/inventory?page=${page - 1}${category ? `&category=${category}` : ""}${status ? `&status=${status}` : ""}${search ? `&search=${encodeURIComponent(search)}` : ""}`}
                    className="rounded border border-charcoal/15 px-3 py-1.5 text-xs font-medium text-charcoal hover:border-plum hover:text-plum"
                  >
                    Previous
                  </Link>
                )}
                {page < totalPages && (
                  <Link
                    href={`/admin/inventory?page=${page + 1}${category ? `&category=${category}` : ""}${status ? `&status=${status}` : ""}${search ? `&search=${encodeURIComponent(search)}` : ""}`}
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
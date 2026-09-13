import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Package, Pencil, Plus, Search } from "lucide-react";

import { getAuthUser } from "@/lib/auth/session";
import { resolveImageUrl } from "@/lib/images";
import { formatPrice } from "@/lib/storefront/format";
import { listAllCategories } from "@/services/categories/categories-service";
import { listPagedProducts } from "@/services/products/products-service";
import { toggleProductActiveAction } from "@/app/admin/actions";

export const metadata: Metadata = {
  title: "Products · Admin",
  robots: { index: false, follow: false },
};

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    status?: string;
    page?: string;
  }>;
}) {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") redirect("/login");
  const actor = { id: user.id, role: user.role as "admin" };

  const params = await searchParams;
  const search = params.search;
  const status = params.status;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const perPage = 20;
  const offset = (page - 1) * perPage;

  const [result, categories] = await Promise.all([
    listPagedProducts(actor, {
      search,
      isActive: status === "archived" ? false : status === "active" ? true : undefined,
      limit: perPage,
      offset,
    }).catch(() => ({ products: [], total: 0 })),
    listAllCategories(actor).catch(() => []),
  ]);

  const { products, total } = result;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-charcoal">Products</h1>
          <p className="mt-1 text-sm text-charcoal-muted">
            {total} products total ({" "}
            {products.filter((p) => p.is_active).length} active on this page)
          </p>
        </div>
        <Link
          href="/admin/products/new"
          className="inline-flex items-center gap-2 rounded-full bg-plum px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-plum-dark"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add product
        </Link>
      </div>

      {/* Filters */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        {[
          { label: "All", value: undefined },
          { label: "Active", value: "active" },
          { label: "Archived", value: "archived" },
        ].map((option) => (
          <Link
            key={option.label}
            href={option.value ? `/admin/products?status=${option.value}` : "/admin/products"}
            className={`inline-flex items-center rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
              status === option.value
                ? "bg-plum text-white"
                : "border border-charcoal/15 bg-white text-charcoal hover:border-plum hover:text-plum"
            }`}
          >
            {option.label}
          </Link>
        ))}
      </div>

      {/* Search */}
      <form className="mt-4" action="/admin/products" method="get">
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
              className="w-full rounded-lg border border-charcoal/15 bg-white py-2.5 pl-10 pr-4 text-sm text-charcoal placeholder:text-charcoal-muted/60 focus:border-plum focus:outline-none focus:ring-2 focus:ring-plum/15"
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

      {products.length === 0 ? (
        <div className="mt-8 rounded-xl border border-charcoal/10 bg-white p-10 text-center">
          <Package className="mx-auto h-10 w-10 text-charcoal-muted/40" aria-hidden="true" />
          <p className="mt-3 text-sm text-charcoal-muted">
            {search || status ? "No products match the current filters." : "No products yet — add your first product."}
          </p>
        </div>
      ) : (
        <div className="mt-8 overflow-hidden rounded-2xl border border-charcoal/10 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] border-collapse text-left">
              <thead>
                <tr className="border-b border-charcoal/10 text-xs uppercase tracking-wide text-charcoal-muted">
                  <th className="px-5 py-3.5 font-semibold">Product</th>
                  <th className="px-5 py-3.5 font-semibold">Category</th>
                  <th className="px-5 py-3.5 font-semibold">Price</th>
                  <th className="px-5 py-3.5 font-semibold">Stock</th>
                  <th className="px-5 py-3.5 font-semibold">Status</th>
                  <th className="px-5 py-3.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal/5">
                {products.map((product) => {
                  const lowStock = product.stock_quantity <= product.low_stock_threshold;
                  return (
                    <tr key={product.id} className="transition-colors hover:bg-cream/50">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="relative h-14 w-11 shrink-0 overflow-hidden rounded-lg border border-charcoal/10 bg-cream">
                            {resolveImageUrl(product.image_url) ? (
                              <Image
                                src={resolveImageUrl(product.image_url)!}
                                alt=""
                                fill
                                sizes="44px"
                                className="object-cover"
                              />
                            ) : null}
                          </div>
                          <div className="min-w-0">
                            <Link
                              href={`/admin/products/${product.id}/edit`}
                              className="block truncate text-sm font-medium text-charcoal hover:text-plum"
                            >
                              {product.name}
                            </Link>
                            <span className="text-xs text-charcoal-muted">
                              {product.sku ?? product.slug}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm text-charcoal-muted">
                        {product.category_id
                          ? categoryName.get(product.category_id) ?? "—"
                          : "—"}
                      </td>
                      <td className="px-5 py-3 text-sm text-charcoal">
                        {formatPrice(product.price)}
                        {product.compare_at_price ? (
                          <span className="ml-1.5 text-xs text-charcoal-muted line-through">
                            {formatPrice(product.compare_at_price)}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={
                            product.stock_quantity === 0
                              ? "text-sm font-medium text-red-600"
                              : lowStock
                                ? "text-sm font-medium text-amber-600"
                                : "text-sm text-charcoal"
                          }
                        >
                          {product.stock_quantity}
                        </span>
                        {lowStock ? (
                          <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                            Low
                          </span>
                        ) : null}
                      </td>
                      <td className="px-5 py-3">
                        <form action={toggleProductActiveAction.bind(null, product.id, !product.is_active)}>
                          <button
                            type="submit"
                            className={
                              product.is_active
                                ? "rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700 transition-colors hover:bg-green-200"
                                : "rounded-full bg-charcoal/10 px-2.5 py-1 text-xs font-medium text-charcoal-muted transition-colors hover:bg-charcoal/15"
                            }
                          >
                            {product.is_active ? "Active" : "Inactive"}
                          </button>
                        </form>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Link
                          href={`/admin/products/${product.id}/edit`}
                          aria-label={`Edit ${product.name}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-charcoal-muted transition-colors hover:bg-plum/10 hover:text-plum"
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </Link>
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
                    href={`/admin/products?page=${page - 1}${status ? `&status=${status}` : ""}${search ? `&search=${encodeURIComponent(search)}` : ""}`}
                    className="rounded border border-charcoal/15 px-3 py-1.5 text-xs font-medium text-charcoal hover:border-plum hover:text-plum"
                  >
                    Previous
                  </Link>
                )}
                {page < totalPages && (
                  <Link
                    href={`/admin/products?page=${page + 1}${status ? `&status=${status}` : ""}${search ? `&search=${encodeURIComponent(search)}` : ""}`}
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
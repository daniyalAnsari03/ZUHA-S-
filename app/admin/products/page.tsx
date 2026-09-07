import Image from "next/image";
import Link from "next/link";
import { Pencil, Plus } from "lucide-react";

import { getAuthUser } from "@/lib/auth/session";
import { formatPrice } from "@/lib/storefront/format";
import { listAllCategories } from "@/services/categories/categories-service";
import { listAllProducts } from "@/services/products/products-service";
import { toggleProductActiveAction } from "@/app/admin/actions";

export default async function AdminProductsPage() {
  const user = await getAuthUser();
  const actor = { id: user!.id, role: user!.role as "admin" };

  const [products, categories] = await Promise.all([
    listAllProducts(actor),
    listAllCategories(actor),
  ]);

  const categoryName = new Map(categories.map((c) => [c.id, c.name]));

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-charcoal">Products</h1>
          <p className="mt-1 text-sm text-charcoal-muted">
            {products.length} total ({products.filter((p) => p.is_active).length} active)
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

      <div className="mt-8 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[720px] border-collapse overflow-hidden rounded-2xl border border-charcoal/10 bg-white text-left">
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
                        {product.image_url ? (
                          <Image
                            src={product.image_url}
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
    </div>
  );
}
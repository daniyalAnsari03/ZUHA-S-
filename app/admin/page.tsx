import Link from "next/link";
import { Package, Tags, TrendingDown } from "lucide-react";

import { getAuthUser } from "@/lib/auth/session";
import { formatPrice } from "@/lib/storefront/format";
import { listAllCategories } from "@/services/categories/categories-service";
import { listAllProducts } from "@/services/products/products-service";

export default async function AdminOverviewPage() {
  const user = await getAuthUser();
  const actor = { id: user!.id, role: user!.role as "admin" };

  const [products, categories] = await Promise.all([
    listAllProducts(actor),
    listAllCategories(actor),
  ]);

  const activeProducts = products.filter((p) => p.is_active).length;
  const lowStock = products
    .filter((p) => p.is_active && p.stock_quantity <= p.low_stock_threshold)
    .sort((a, b) => a.stock_quantity - b.stock_quantity);
  const activeCategories = categories.filter((c) => c.is_active).length;

  const stats = [
    {
      label: "Products",
      value: `${activeProducts} / ${products.length}`,
      hint: "active / total",
      href: "/admin/products",
      icon: Package,
    },
    {
      label: "Categories",
      value: `${activeCategories} / ${categories.length}`,
      hint: "active / total",
      href: "/admin/categories",
      icon: Tags,
    },
    {
      label: "Low stock",
      value: lowStock.length,
      hint: "products at or below threshold",
      href: "/admin/products",
      icon: TrendingDown,
    },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-charcoal">Overview</h1>
          <p className="mt-1 text-sm text-charcoal-muted">
            Signed in as {user?.email ?? "admin"}.
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="rounded-2xl border border-charcoal/10 bg-white p-5 transition-colors hover:border-plum/30"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-charcoal-muted">
                {stat.label}
              </p>
              <stat.icon
                className="h-4 w-4 text-plum-light"
                aria-hidden="true"
              />
            </div>
            <p className="mt-3 font-serif text-3xl text-charcoal">{stat.value}</p>
            <p className="mt-1 text-xs text-charcoal-muted">{stat.hint}</p>
          </Link>
        ))}
      </div>

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-xl text-charcoal">Needs attention</h2>
          <Link
            href="/admin/products"
            className="text-sm font-medium text-plum hover:text-plum-dark"
          >
            View all products
          </Link>
        </div>

        {lowStock.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-charcoal/10 bg-white px-5 py-8 text-center text-sm text-charcoal-muted">
            No low-stock products — inventory is healthy.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-charcoal/5 overflow-hidden rounded-2xl border border-charcoal/10 bg-white">
            {lowStock.slice(0, 5).map((product) => (
              <li key={product.id}>
                <Link
                  href={`/admin/products/${product.id}/edit`}
                  className="flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-cream/60"
                >
                  <span className="text-sm font-medium text-charcoal">
                    {product.name}
                  </span>
                  <span className="flex items-center gap-3 text-sm text-charcoal-muted">
                    <span>
                      {product.stock_quantity} left ·{" "}
                      {formatPrice(product.price)}
                    </span>
                    <span
                      className={
                        product.stock_quantity === 0
                          ? "rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700"
                          : "rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700"
                      }
                    >
                      {product.stock_quantity === 0
                        ? "Out of stock"
                        : "Low stock"}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
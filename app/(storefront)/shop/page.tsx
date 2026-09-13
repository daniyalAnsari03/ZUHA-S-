import type { Metadata } from "next";

import { Container } from "@/components/ui/container";
import { ProductCard } from "@/components/storefront/product-card";
import {
  getAllActiveProducts,
  getCategoryBySlug,
  getProductsByCategory,
} from "@/lib/storefront/data";

export const metadata: Metadata = {
  title: "Shop",
  description:
    "Browse the dINS by Daniyal collection — Jamawar, Embroidery, Cut-Dana, Plain, Unstitched and Lawn.",
};

type ShopPageProps = {
  searchParams: Promise<{ category?: string | string[] }>;
};

/**
 * Lightweight shop index for the Phase 2 mock catalog. Read-only aggregation
 * of the storefront data layer; full product pages/catalog management belong
 * to a later phase.
 */
export default async function ShopPage({ searchParams }: ShopPageProps) {
  const { category } = await searchParams;
  const raw = Array.isArray(category) ? category[0] : category;
  const activeCategory = raw ? await getCategoryBySlug(raw) : null;

  const products = activeCategory
    ? await getProductsByCategory(activeCategory.slug)
    : await getAllActiveProducts();

  return (
    <main className="flex-1 bg-white">
      <Container size="lg" className="py-10 sm:py-14">
        <p className="text-[11px] uppercase tracking-[0.32em] text-gold-muted">
          dINS by Daniyal
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <h1 className="font-serif text-3xl text-charcoal sm:text-4xl">
            {activeCategory ? activeCategory.name : "All Products"}
          </h1>
          {activeCategory ? (
            <p className="max-w-sm text-sm text-charcoal-muted">
              {activeCategory.description}
            </p>
          ) : null}
        </div>

        <div className="mt-8 grid grid-cols-1 gap-x-4 gap-y-10 sm:grid-cols-2 sm:gap-x-6 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>

        {products.length === 0 ? (
          <p className="py-16 text-center text-sm text-charcoal-muted">
            Nothing here yet — please check back soon.
          </p>
        ) : null}
      </Container>
    </main>
  );
}
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Container } from "@/components/ui/container";
import { getNewArrivals, getProductsByCategory } from "@/lib/storefront/data";
import { categoryHref } from "@/lib/storefront/format";
import type { ProductSection } from "@/lib/storefront/types";

import { ProductCard } from "./product-card";

type ProductSectionProps = {
  section: ProductSection;
};

/**
 * Reusable homepage product row: curated products + "View All" CTA. The
 * section configuration (title, category, products) comes from the storefront
 * data layer and is admin-controllable in a later phase.
 *
 * Performance note: the row is a single set of product cards that is a
 * scroll-snapping flex row on small screens and a grid from `sm` up. It
 * deliberately avoids rendering a second, hidden copy of the same cards for
 * the other breakpoint — duplicating them doubled the image requests, the
 * hydrated client components and the LCP/TBT cost of every homepage visit.
 */
export async function ProductSectionView({ section }: ProductSectionProps) {
  const source = section.categorySlug
    ? await getProductsByCategory(section.categorySlug)
    : await getNewArrivals();
  const products = source.slice(0, 4);
  const viewAllHref = section.categorySlug
    ? categoryHref(section.categorySlug)
    : "/shop";

  if (products.length === 0) return null;

  return (
    <section
      id={section.id}
      aria-labelledby={`${section.id}-heading`}
      className="bg-white py-12 sm:py-16"
    >
      <Container>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2
            id={`${section.id}-heading`}
            className="font-serif text-2xl text-charcoal sm:text-3xl"
          >
            {section.title}
          </h2>
          <Link
            href={viewAllHref}
            className="group inline-flex items-center gap-2 text-sm font-medium text-plum hover:text-plum-dark"
          >
            View All Products
            <ArrowRight
              className="h-4 w-4 transition-transform group-hover:translate-x-1"
              aria-hidden="true"
            />
          </Link>
        </div>

        <div className="-mx-4 mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-x-6 sm:gap-y-8 sm:overflow-visible sm:px-0 sm:pb-0 md:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <div
              key={product.id}
              className="w-[60%] min-w-0 shrink-0 snap-start max-[360px]:w-[68%] sm:w-auto sm:shrink"
            >
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

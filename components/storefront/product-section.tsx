import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Reveal } from "@/components/motion/reveal";
import { Container } from "@/components/ui/container";
import { getNewArrivals, getProductsByCategory } from "@/lib/storefront/data";
import { categoryHref } from "@/lib/storefront/format";
import type { ProductSection } from "@/lib/storefront/types";

import { ProductCard } from "./product-card";
import { ProductCarousel } from "./product-carousel";

type ProductSectionProps = {
  section: ProductSection;
};

/**
 * Reusable homepage product row: curated products + "View All" CTA. The
 * section configuration (title, category, products) comes from the storefront
 * data layer and is admin-controllable in a later phase.
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
        <Reveal>
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
        </Reveal>

        <ProductCarousel products={products} />

        <div className="mt-8 hidden grid-cols-2 gap-x-4 gap-y-8 sm:grid sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4">
          {products.map((product, index) => (
            <Reveal key={product.id} delay={index * 0.05}>
              <ProductCard product={product} />
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
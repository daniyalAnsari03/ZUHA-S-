import { Reveal } from "@/components/motion/reveal";
import { Container } from "@/components/ui/container";
import type { Category } from "@/lib/storefront/types";

import { CategoryCard } from "./category-card";

type ShopByCategoryProps = {
  categories: Category[];
};

/**
 * "Shop By Category" section that overlaps the hero bottom edge. The
 * background transitions from a slightly darker cream near the hero to white,
 * so cards sit intentionally on the hero transition rather than after a gap.
 */
export function ShopByCategory({ categories }: ShopByCategoryProps) {
  return (
    <section
      aria-labelledby="shop-by-category-heading"
      className="relative z-10 -mt-24 rounded-t-3xl bg-gradient-to-b from-cream via-ivory to-white pb-4 pt-10 sm:-mt-28 sm:rounded-t-[2rem] sm:pt-14"
    >
      <Container size="lg">
        <Reveal>
          <div className="mb-8 text-center sm:mb-10">
            <p className="text-[11px] uppercase tracking-[0.32em] text-gold-muted">
              Curated for you
            </p>
            <h2
              id="shop-by-category-heading"
              className="mt-2 font-serif text-2xl text-charcoal sm:text-3xl"
            >
              Shop by Category
            </h2>
          </div>
        </Reveal>

        <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
          {categories.map((category, index) => (
            <Reveal key={category.id} delay={index * 0.06}>
              <CategoryCard category={category} />
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
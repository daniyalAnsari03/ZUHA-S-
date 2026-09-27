import { Reveal } from "@/components/motion/reveal";
import { Container } from "@/components/ui/container";
import type { Category } from "@/lib/storefront/types";
import { getHomepageContent } from "@/services/cms/cms-service";

import { CategoryCard } from "./category-card";

type ShopByCategoryProps = {
  categories: Category[];
};

/**
 * "Shop By Category" section positioned directly after the hero with a clean
 * direct transition (no overlap, no white sliver, no gap). Reads heading
 * from CMS when available.
 */
export async function ShopByCategory({ categories }: ShopByCategoryProps) {
  let eyebrow = "Curated for you";
  let heading = "Shop by Category";

  try {
    const content = await getHomepageContent();
    if (content.shopByCategoryEyebrow) eyebrow = content.shopByCategoryEyebrow;
    if (content.shopByCategoryHeading) heading = content.shopByCategoryHeading;
  } catch {
    // Use defaults
  }

  return (
    <section
      aria-labelledby="shop-by-category-heading"
      className="gold-sheen relative z-10 -mt-16 overflow-hidden rounded-[4rem] bg-gradient-to-b from-[#c9b184] via-ivory to-white pb-4 pt-10 sm:pt-14"
    >
      <Container size="lg" className="relative z-10">
        <Reveal>
          <div className="mb-8 text-center sm:mb-10">
            <p className="text-[11px] uppercase tracking-[0.32em] text-gold-muted">
              {eyebrow}
            </p>
            <h2
              id="shop-by-category-heading"
              className="mt-2 font-serif text-2xl text-charcoal sm:text-3xl"
            >
              {heading}
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

import { BrandStory } from "@/components/storefront/brand-story";
import { Hero } from "@/components/storefront/hero";
import { Newsletter } from "@/components/storefront/newsletter";
import { ProductSectionView } from "@/components/storefront/product-section";
import { ShopByCategory } from "@/components/storefront/shop-by-category";
import { SocialGallery } from "@/components/storefront/social-gallery";
import {
  getActiveCategories,
  getActiveHeroSlides,
  getActiveProductSections,
} from "@/lib/storefront/data";

export default async function HomePage() {
  const heroSlides = getActiveHeroSlides();
  const hero = heroSlides[0];

  const [categories, sections] = await Promise.all([
    getActiveCategories(),
    getActiveProductSections(),
  ]);

  return (
    <main>
      {hero ? <Hero slide={hero} /> : null}
      <ShopByCategory categories={categories} />
      {sections.map((section) => (
        <ProductSectionView key={section.id} section={section} />
      ))}
      <BrandStory />
      <SocialGallery />
      <Newsletter />
    </main>
  );
}
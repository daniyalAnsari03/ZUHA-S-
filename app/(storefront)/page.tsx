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
import { getHomepageContent } from "@/services/cms/cms-service";

export default async function HomePage() {
  const heroSlides = await getActiveHeroSlides();
  const hero = heroSlides[0];

  const [categories, sections, homepageContent] = await Promise.all([
    getActiveCategories(),
    getActiveProductSections(),
    getHomepageContent().catch(() => ({})),
  ]);

  const newsletter = {
    eyebrow:
      "newsletterEyebrow" in homepageContent
        ? homepageContent.newsletterEyebrow
        : undefined,
    heading:
      "newsletterHeading" in homepageContent
        ? homepageContent.newsletterHeading
        : undefined,
    description:
      "newsletterDescription" in homepageContent
        ? homepageContent.newsletterDescription
        : undefined,
    ctaLabel:
      "newsletterCtaLabel" in homepageContent
        ? homepageContent.newsletterCtaLabel
        : undefined,
  };

  return (
    <main>
      {hero ? (
        <div className="bg-plum-dark">
          <Hero slide={hero} />
        </div>
      ) : null}
      <ShopByCategory categories={categories} />
      {sections.map((section) => (
        <ProductSectionView key={section.id} section={section} />
      ))}
      <BrandStory />
      <SocialGallery />
      <Newsletter
        eyebrow={newsletter.eyebrow}
        heading={newsletter.heading}
        description={newsletter.description}
        ctaLabel={newsletter.ctaLabel}
      />
    </main>
  );
}

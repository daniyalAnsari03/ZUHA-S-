import { Footer } from "@/components/storefront/footer";
import { Hero } from "@/components/storefront/hero";
import { HomeSlides } from "@/components/storefront/home-slides";
import {
  getActiveCategories,
  getActiveHeroSlides,
} from "@/lib/storefront/data";

export default async function HomePage() {
  const heroSlides = await getActiveHeroSlides();
  const hero = heroSlides[0];

  const categories = await getActiveCategories();

  return (
    <main>
      {/* The hero and the category slides are one full-screen scroll-snap stack,
          and the footer is the closing slide of that same stack, so it is passed
          in rather than rendered here. Every other page gets the footer from the
          layout's parallel slot. The stack is the whole page: nothing renders
          after the footer slide, so the footer slide is genuinely the last thing
          on the homepage. */}
      <HomeSlides
        hero={hero ? <Hero slide={hero} /> : null}
        categories={categories}
        footer={<Footer categories={categories} />}
      />
    </main>
  );
}
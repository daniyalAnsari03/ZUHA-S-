import { getCmsContent } from "@/services/cms/cms-service";
import { HomepageEditor } from "./homepage-editor";

type HeroData = {
  id: string;
  image: string;
  eyebrow: string;
  heading: string;
  paragraph: string;
  ctaLabel: string;
  ctaHref: string;
  active: boolean;
  order: number;
};

type HomepageData = {
  shopByCategoryHeading: string;
  shopByCategoryEyebrow: string;
  brandStoryHeading: string;
  brandStoryBody: string;
  brandStoryCta: string;
  brandStoryImage: string;
  socialHeading: string;
  socialEyebrow: string;
  socialDescription: string;
  socialHandle: string;
  socialImages: string[];
  newsletterHeading: string;
  newsletterEyebrow: string;
  newsletterDescription: string;
  newsletterCtaLabel: string;
  footerAbout: string;
  footerCopyright: string;
  footerTagline: string;
};

const DEFAULT_HERO: HeroData = {
  id: "hero-1",
  image: "/images/placeholders/hero.svg",
  eyebrow: "Jamawar · Embroidery · Lawn",
  heading: "Where Pakistani craftsmanship meets modern elegance.",
  paragraph:
    "Hand-finished embroidery, heritage jamawar and feather-light lawn — designed for the way you live.",
  ctaLabel: "Shop the Collection",
  ctaHref: "/shop",
  active: true,
  order: 1,
};

const DEFAULT_HOMEPAGE: HomepageData = {
  shopByCategoryHeading: "Shop by Category",
  shopByCategoryEyebrow: "Curated for you",
  brandStoryHeading:
    "Craftsmanship that carries heritage into the modern wardrobe.",
  brandStoryBody:
    "dINS by Daniyal is a Pakistani fashion label centred on considered detail — hand-finished embroidery, woven jamawar and unstitched collections made to be worn and kept.\n\nEach piece begins with fabric and technique; the result is design that feels at once familiar and new. We care less about seasons and more about garments you reach for again.",
  brandStoryCta: "Designed and finished in Pakistan.",
  brandStoryImage: "/images/placeholders/product-3.svg",
  socialHeading: "Follow @dinsbydaniyal",
  socialEyebrow: "On Instagram",
  socialDescription: "A closer look at the studio, the craft and the collection.",
  socialHandle: "@dinsbydaniyal",
  socialImages: [
    "/images/placeholders/social-1.svg",
    "/images/placeholders/social-2.svg",
    "/images/placeholders/social-3.svg",
    "/images/placeholders/social-4.svg",
    "/images/placeholders/social-5.svg",
    "/images/placeholders/social-6.svg",
  ],
  newsletterHeading: "Early access to new collections",
  newsletterEyebrow: "Join the list",
  newsletterDescription:
    "Be the first to know about fresh drops, limited pieces and private previews.",
  newsletterCtaLabel: "Subscribe",
  footerAbout:
    "A Pakistani fashion label for considered craftsmanship — embroidery, jamawar, lawn and unstitched collections.",
  footerCopyright: "All rights reserved.",
  footerTagline: "Made with care in Pakistan.",
};

export default async function HomepageCmsPage() {
  const [heroRaw, homepageRaw] = await Promise.all([
    getCmsContent("hero"),
    getCmsContent("homepage"),
  ]);

  const hero: HeroData = {
    ...DEFAULT_HERO,
    ...(heroRaw && typeof heroRaw === "object" ? heroRaw : {}),
  };

  const homepage: HomepageData = {
    ...DEFAULT_HOMEPAGE,
    ...(homepageRaw && typeof homepageRaw === "object" ? homepageRaw : {}),
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-3xl text-charcoal">Homepage CMS</h1>
        <p className="mt-1 text-sm text-charcoal-muted">
          Edit the hero section, homepage headings, brand story, social gallery,
          newsletter, and footer content.
        </p>
      </div>

      <HomepageEditor hero={hero} homepage={homepage} />
    </div>
  );
}

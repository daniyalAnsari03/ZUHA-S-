/**
 * Storefront configuration types.
 *
 * Phase 2 uses a local mock/static data layer so the premium storefront can
 * be built and tested without a live catalog. The shapes below mirror the
 * entities that Phase 3+ will provision from Supabase (products, categories,
 * homepage/hero/announcement records) so the presentation layer can later be
 * wired to services without component rewrites.
 */

export type Announcement = {
  id: string;
  message: string;
  /** Href the message links to, if any. */
  href?: string;
  active: boolean;
  /** Lower values display first. */
  order: number;
  /** Seconds each active message stays visible. */
  durationMs: number;
};

export type HeroSlide = {
  id: string;
  /** Main backdrop image (path under /public). */
  image: string;
  eyebrow?: string;
  heading: string;
  paragraph: string;
  ctaLabel: string;
  ctaHref: string;
  active: boolean;
  order: number;
};

export type Category = {
  id: string;
  slug: string;
  name: string;
  description: string;
  image: string;
  active: boolean;
  order: number;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  image: string;
  categorySlug: string;
  fabric?: string;
  embroidery?: string;
  color?: string;
  /** Small editorial label such as "New", when appropriate. */
  label?: string;
  active: boolean;
};

export type ProductSection = {
  id: string;
  /** Homepage section title, e.g. "New Arrivals". */
  title: string;
  /** Category the section curates, or null for a cross-category edit. */
  categorySlug: string | null;
  /** Product ids shown in this section (capped at the grid size). */
  productIds: string[];
};
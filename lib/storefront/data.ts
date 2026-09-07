import type {
  Announcement,
  Category,
  HeroSlide,
  Product,
  ProductSection,
} from "./types";

/**
 * Phase 2 mock storefront configuration.
 *
 * This file is the single data boundary between the presentation layer and
 * future Supabase-backed services. Components import from here only; they
 * never hold catalog data themselves. In later phases these exports will be
 * replaced by service reads without component changes.
 */

const IMG = "/images/placeholders";

/* ---------------------------------------------------------------------------
 * Announcements — only one is visible at a time (see AnnouncementBar).
 * ------------------------------------------------------------------------- */

export const announcements: Announcement[] = [
  {
    id: "announcement-1",
    message: "Complimentary shipping on orders over PKR 15,000",
    active: true,
    order: 1,
    durationMs: 5000,
  },
  {
    id: "announcement-2",
    message: "New arrivals — Jamawar & Cut-Dana embroidery now online",
    active: true,
    order: 2,
    durationMs: 5000,
  },
  {
    id: "announcement-3",
    message: "Subscribe for early access to the seasonal collection",
    active: true,
    order: 3,
    durationMs: 5000,
  },
];

export function getActiveAnnouncements(): Announcement[] {
  return announcements
    .filter((a) => a.active)
    .sort((a, b) => a.order - b.order);
}

/* ---------------------------------------------------------------------------
 * Hero
 * ------------------------------------------------------------------------- */

export const heroSlides: HeroSlide[] = [
  {
    id: "hero-1",
    image: `${IMG}/hero.svg`,
    eyebrow: "Jamawar · Embroidery · Lawn",
    heading: "Where Pakistani craftsmanship meets modern elegance.",
    paragraph:
      "Hand-finished embroidery, heritage jamawar and feather-light lawn — designed for the way you live.",
    ctaLabel: "Shop the Collection",
    ctaHref: "/shop",
    active: true,
    order: 1,
  },
];

export function getActiveHeroSlides(): HeroSlide[] {
  return heroSlides.filter((s) => s.active).sort((a, b) => a.order - b.order);
}

/* ---------------------------------------------------------------------------
 * Categories
 * ------------------------------------------------------------------------- */

export const categories: Category[] = [
  {
    id: "cat-jamawar",
    slug: "jamawar",
    name: "Jamawar",
    description: "Hand-woven jamawar in the Kashmir tradition.",
    image: `${IMG}/category-jamawar.svg`,
    active: true,
    order: 1,
  },
  {
    id: "cat-embroidery",
    slug: "embroidery",
    name: "Embroidery",
    description: "Fine threadwork finished by hand.",
    image: `${IMG}/category-embroidery.svg`,
    active: true,
    order: 2,
  },
  {
    id: "cat-cut-dana",
    slug: "cut-dana",
    name: "Cut-Dana Embroidery",
    description: "Sequinned cut-dana with a quiet lustre.",
    image: `${IMG}/category-cut-dana.svg`,
    active: true,
    order: 3,
  },
  {
    id: "cat-plain",
    slug: "plain",
    name: "Plain",
    description: "Clean cuts that let the fabric speak.",
    image: `${IMG}/category-plain.svg`,
    active: true,
    order: 4,
  },
  {
    id: "cat-unstitched",
    slug: "unstitched",
    name: "Unstitched",
    description: "Signature unstitched three-piece collections.",
    image: `${IMG}/category-unstitched.svg`,
    active: true,
    order: 5,
  },
  {
    id: "cat-lawn",
    slug: "lawn",
    name: "Lawn",
    description: "Featherlight lawn made for warmer days.",
    image: `${IMG}/category-lawn.svg`,
    active: true,
    order: 6,
  },
];

export function getActiveCategories(): Category[] {
  return categories.filter((c) => c.active).sort((a, b) => a.order - b.order);
}

export function getCategoryBySlug(slug: string): Category | null {
  return categories.find((c) => c.slug === slug && c.active) ?? null;
}

/* ---------------------------------------------------------------------------
 * Products
 * ------------------------------------------------------------------------- */

export const products: Product[] = [
  // New arrivals (cross-category)
  {
    id: "prod-khirke-jamawar",
    slug: "khirke-jamawar",
    name: "Khirke Jamawar",
    description: "Hand-woven jamawar kurta with mirrored khirke motifs.",
    price: 34500,
    image: `${IMG}/product-1.svg`,
    categorySlug: "jamawar",
    fabric: "Hand-woven jamawar",
    embroidery: "Woven motif",
    color: "Plum & gold",
    label: "New",
    active: true,
  },
  {
    id: "prod-sitara-cut-dana",
    slug: "sitara-cut-dana",
    name: "Sitara Cut-Dana",
    description: "Cut-dana kurta scattered with fine star sequins.",
    price: 21800,
    image: `${IMG}/product-2.svg`,
    categorySlug: "cut-dana",
    fabric: "Cotton silk",
    embroidery: "Cut-dana",
    color: "Deep plum",
    label: "New",
    active: true,
  },
  {
    id: "prod-gulab-thread",
    slug: "gulab-thread-tunic",
    name: "Gulab Thread Tunic",
    description: "Resham thread tunic with hand-embroidered rosework.",
    price: 18900,
    image: `${IMG}/product-3.svg`,
    categorySlug: "embroidery",
    fabric: "Cotton silk",
    embroidery: "Resham thread",
    color: "Ivory",
    label: "New",
    active: true,
  },
  {
    id: "prod-dastaan",
    slug: "dastaan-unstitched",
    name: "Dastaan Unstitched",
    description: "Unstitched three-piece in soft washed texture.",
    price: 12400,
    image: `${IMG}/product-4.svg`,
    categorySlug: "unstitched",
    fabric: "Washed cotton",
    color: "Warm ivory",
    label: "New",
    active: true,
  },

  // Jamawar
  {
    id: "prod-bahadur-jamawar",
    slug: "bahadur-shahi-jamawar",
    name: "Bahadur Shahi Jamawar",
    description: "Editorial jamawar panel with classic shahi borders.",
    price: 38900,
    image: `${IMG}/product-5.svg`,
    categorySlug: "jamawar",
    fabric: "Hand-woven jamawar",
    embroidery: "Woven motif",
    color: "Ivory & gold",
    active: true,
  },
  {
    id: "prod-mehrab-jamawar",
    slug: "mehrab-jamawar",
    name: "Mehrab Jamawar",
    description: "Jamawar kurta with arch-inspired woven panels.",
    price: 32700,
    image: `${IMG}/product-6.svg`,
    categorySlug: "jamawar",
    fabric: "Hand-woven jamawar",
    embroidery: "Woven motif",
    color: "Charcoal & gold",
    active: true,
  },
  {
    id: "prod-sitara-jamawar",
    slug: "sitara-motif-jamawar",
    name: "Sitara Motif Jamawar",
    description: "Small star motifs woven across a fine base.",
    price: 29900,
    image: `${IMG}/product-2.svg`,
    categorySlug: "jamawar",
    fabric: "Hand-woven jamawar",
    embroidery: "Woven motif",
    color: "Plum",
    active: true,
  },

  // Embroidery
  {
    id: "prod-shalimar",
    slug: "shalimar-embroidery",
    name: "Shalimar Embroidery",
    description: "Garden-inspired resham embroidery on cotton silk.",
    price: 20500,
    image: `${IMG}/product-6.svg`,
    categorySlug: "embroidery",
    fabric: "Cotton silk",
    embroidery: "Resham thread",
    color: "Cream",
    active: true,
  },
  {
    id: "prod-qand-aab",
    slug: "qand-aab-embroidery",
    name: "Qand Aab Embroidery",
    description: "Delicate drop-stitch embroidery in soft tones.",
    price: 17200,
    image: `${IMG}/product-1.svg`,
    categorySlug: "embroidery",
    fabric: "Cotton",
    embroidery: "Drop stitch",
    color: "Sand",
    active: true,
  },
  {
    id: "prod-dhaga-resham",
    slug: "dhaga-resham-kurta",
    name: "Dhaga Resham Kurta",
    description: "A minimal kurta elevated by contrast resham work.",
    price: 19800,
    image: `${IMG}/product-4.svg`,
    categorySlug: "embroidery",
    fabric: "Cotton silk",
    embroidery: "Resham thread",
    color: "Ivory",
    active: true,
  },

  // Cut-Dana
  {
    id: "prod-chandni-cut-dana",
    slug: "chandni-cut-dana",
    name: "Chandni Cut-Dana",
    description: "Moonlit cut-dana motifs on a slim silhouette.",
    price: 22400,
    image: `${IMG}/product-3.svg`,
    categorySlug: "cut-dana",
    fabric: "Cotton silk",
    embroidery: "Cut-dana",
    color: "Dusty gold",
    active: true,
  },
  {
    id: "prod-roshni-cut-dana",
    slug: "roshni-cut-dana",
    name: "Roshni Cut-Dana",
    description: "Radiant cut-dana panels with a fine shimmer.",
    price: 21600,
    image: `${IMG}/product-5.svg`,
    categorySlug: "cut-dana",
    fabric: "Cotton silk",
    embroidery: "Cut-dana",
    color: "Plum",
    active: true,
  },
  {
    id: "prod-maah-cut-dana",
    slug: "maah-cut-dana",
    name: "Maah Cut-Dana",
    description: "Subtle crescent cut-dana detail on ivory.",
    price: 19900,
    image: `${IMG}/product-6.svg`,
    categorySlug: "cut-dana",
    fabric: "Cotton silk",
    embroidery: "Cut-dana",
    color: "Ivory",
    active: true,
  },

  // Plain
  {
    id: "prod-sukoon",
    slug: "sukoon-cotton",
    name: "Sukoon Cotton",
    description: "A perfectly plain cotton kurta in a calm cut.",
    price: 9900,
    image: `${IMG}/product-4.svg`,
    categorySlug: "plain",
    fabric: "Pure cotton",
    color: "Warm white",
    active: true,
  },
  {
    id: "prod-saada",
    slug: "saada-kurta",
    name: "Saada Kurta",
    description: "Unlined and unembellished, made for layering.",
    price: 9400,
    image: `${IMG}/product-1.svg`,
    categorySlug: "plain",
    fabric: "Pure cotton",
    color: "Sand",
    active: true,
  },
  {
    id: "prod-rihla",
    slug: "rihla-cotton",
    name: "Rihla Cotton Ensemble",
    description: "A plain cotton ensemble with a relaxed drape.",
    price: 11600,
    image: `${IMG}/product-3.svg`,
    categorySlug: "plain",
    fabric: "Cotton",
    color: "Cream",
    active: true,
  },
  {
    id: "prod-naseem",
    slug: "naseem-plain-kurta",
    name: "Naseem Plain Kurta",
    description: "The quiet luxury of fine cotton and clean lines.",
    price: 10400,
    image: `${IMG}/product-2.svg`,
    categorySlug: "plain",
    fabric: "Cotton",
    color: "Ivory",
    active: true,
  },

  // Unstitched
  {
    id: "prod-mitti",
    slug: "mitti-unstitched",
    name: "Mitti Unstitched",
    description: "Unstitched three-piece grounded in earthy tones.",
    price: 13100,
    image: `${IMG}/product-5.svg`,
    categorySlug: "unstitched",
    fabric: "Washed cotton",
    color: "Clay",
    active: true,
  },
  {
    id: "prod-hira",
    slug: "hira-unstitched",
    name: "Hira Unstitched",
    description: "Unstitched set with fine tonal ruching details.",
    price: 13800,
    image: `${IMG}/product-6.svg`,
    categorySlug: "unstitched",
    fabric: "Washed cotton",
    color: "Warm ivory",
    active: true,
  },
  {
    id: "prod-bagh",
    slug: "bagh-unstitched",
    name: "Bagh Unstitched",
    description: "An unstitched three-piece cut from soft lawn.",
    price: 11800,
    image: `${IMG}/product-1.svg`,
    categorySlug: "unstitched",
    fabric: "Lawn",
    color: "Cream",
    active: true,
  },

  // Lawn
  {
    id: "prod-abtiha",
    slug: "abtiha-lawn",
    name: "Abtiha Lawn",
    description: "Featherlight lawn shirt with a breezy drape.",
    price: 8900,
    image: `${IMG}/product-2.svg`,
    categorySlug: "lawn",
    fabric: "Premium lawn",
    color: "Dusty rose",
    active: true,
  },
  {
    id: "prod-subah",
    slug: "subah-lawn",
    name: "Subah Lawn",
    description: "Crisp lawn shirt in a soft morning palette.",
    price: 9200,
    image: `${IMG}/product-3.svg`,
    categorySlug: "lawn",
    fabric: "Premium lawn",
    color: "Pale gold",
    active: true,
  },
  {
    id: "prod-raat-ki-rani",
    slug: "raat-ki-rani-lawn",
    name: "Raat Ki Rani Lawn",
    description: "Night-blooming floral on lightweight lawn.",
    price: 9700,
    image: `${IMG}/product-4.svg`,
    categorySlug: "lawn",
    fabric: "Premium lawn",
    embroidery: "Printed floral",
    color: "Ivory",
    active: true,
  },
  {
    id: "prod-bahaur",
    slug: "bahaur-lawn",
    name: "Bahaur Lawn",
    description: "A fresh spring-weight lawn shirt.",
    price: 8800,
    image: `${IMG}/product-5.svg`,
    categorySlug: "lawn",
    fabric: "Premium lawn",
    color: "Cream",
    active: true,
  },
];

export function getProductById(id: string): Product | null {
  return products.find((p) => p.id === id && p.active) ?? null;
}

export function getProductsByCategory(slug: string): Product[] {
  return products.filter((p) => p.categorySlug === slug && p.active);
}

export function getAllActiveProducts(): Product[] {
  return products.filter((p) => p.active);
}

export function resolveProducts(ids: string[], limit = 4): Product[] {
  return ids
    .map((id) => getProductById(id))
    .filter((p): p is Product => p !== null)
    .slice(0, limit);
}

/* ---------------------------------------------------------------------------
 * Homepage product sections
 * ------------------------------------------------------------------------- */

export const productSections: ProductSection[] = [
  {
    id: "section-new-arrivals",
    title: "New Arrivals",
    categorySlug: null,
    productIds: [
      "prod-khirke-jamawar",
      "prod-sitara-cut-dana",
      "prod-gulab-thread",
      "prod-dastaan",
    ],
  },
  {
    id: "section-jamawar",
    title: "Jamawar",
    categorySlug: "jamawar",
    productIds: [
      "prod-khirke-jamawar",
      "prod-bahadur-jamawar",
      "prod-mehrab-jamawar",
      "prod-sitara-jamawar",
    ],
  },
  {
    id: "section-embroidery",
    title: "Embroidery",
    categorySlug: "embroidery",
    productIds: [
      "prod-gulab-thread",
      "prod-shalimar",
      "prod-qand-aab",
      "prod-dhaga-resham",
    ],
  },
  {
    id: "section-cut-dana",
    title: "Cut-Dana Embroidery",
    categorySlug: "cut-dana",
    productIds: [
      "prod-sitara-cut-dana",
      "prod-chandni-cut-dana",
      "prod-roshni-cut-dana",
      "prod-maah-cut-dana",
    ],
  },
  {
    id: "section-plain",
    title: "Plain",
    categorySlug: "plain",
    productIds: [
      "prod-sukoon",
      "prod-saada",
      "prod-rihla",
      "prod-naseem",
    ],
  },
  {
    id: "section-unstitched",
    title: "Unstitched",
    categorySlug: "unstitched",
    productIds: [
      "prod-dastaan",
      "prod-mitti",
      "prod-hira",
      "prod-bagh",
    ],
  },
  {
    id: "section-lawn",
    title: "Lawn",
    categorySlug: "lawn",
    productIds: [
      "prod-abtiha",
      "prod-subah",
      "prod-raat-ki-rani",
      "prod-bahaur",
    ],
  },
];

export function getActiveProductSections(): ProductSection[] {
  return productSections.filter((s) => s.productIds.length > 0);
}
import { unstable_cache } from "next/cache";

import { STORE_CACHE_TAGS, STORE_CACHE_TTL_SECONDS } from "./cache";
import type {
  Announcement,
  Category,
  HeroSlide,
  Product,
  ProductSection,
} from "./types";

/**
 * Storefront data boundary.
 *
 * Reads products and categories from the real Supabase database via the
 * service layer. If the database is unreachable or returns an error the layer
 * falls back to the static mock catalog (identical seed data) so the storefront
 * and production build remain available even in degraded state.
 *
 * Announcements and hero slides are CMS-controlled: read from the
 * `site_content` table when available, falling back to static defaults.
 *
 * Functions that supply DB data are async — callers in Server Components must
 * `await` them.
 */

const IMG = "/images/placeholders";

/* ---------------------------------------------------------------------------
 * Announcements — CMS-first with static fallback
 * ------------------------------------------------------------------------- */

const FALLBACK_ANNOUNCEMENTS: Announcement[] = [
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

const loadAnnouncements = unstable_cache(
  async (): Promise<Announcement[]> => {
    try {
      const { getAnnouncements } = await import("@/services/cms/cms-service");
      const items = await getAnnouncements();
      if (items.length > 0) {
        return items.filter((a) => a.active).sort((a, b) => a.order - b.order);
      }
    } catch {
      // CMS not available, use fallback
    }
    return FALLBACK_ANNOUNCEMENTS.filter((a) => a.active).sort(
      (a, b) => a.order - b.order,
    );
  },
  ["storefront-active-announcements"],
  { tags: [STORE_CACHE_TAGS.cms], revalidate: STORE_CACHE_TTL_SECONDS },
);

export async function getActiveAnnouncements(): Promise<Announcement[]> {
  return loadAnnouncements();
}

/* ---------------------------------------------------------------------------
 * Hero — CMS-first with static fallback
 * ------------------------------------------------------------------------- */

const FALLBACK_HERO: HeroSlide = {
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
};

const loadHeroSlides = unstable_cache(
  async (): Promise<HeroSlide[]> => {
    try {
      const { getHeroSlide } = await import("@/services/cms/cms-service");
      const slide = await getHeroSlide();
      if (slide && slide.heading) {
        return [slide]
          .filter((s) => s.active)
          .sort((a, b) => a.order - b.order);
      }
    } catch {
      // CMS not available, use fallback
    }
    return [FALLBACK_HERO];
  },
  ["storefront-active-hero-slides"],
  { tags: [STORE_CACHE_TAGS.cms], revalidate: STORE_CACHE_TTL_SECONDS },
);

export async function getActiveHeroSlides(): Promise<HeroSlide[]> {
  return loadHeroSlides();
}

/* ---------------------------------------------------------------------------
 * Static fallback catalog (identical to Phase 2 seed data).
 * Used only when Supabase is unreachable.
 * --------------------------------------------------------------------- */

const FALLBACK_CATEGORIES: Category[] = [
  {
    id: "cat-jamawar",
    slug: "jamawar",
    name: "Jamawar",
    description: "Hand-woven jamawar in the Kashmir tradition.",
    image: `${IMG}/category-jamawar.svg`,
    mobileImage: "",
    active: true,
    order: 1,
  },
  {
    id: "cat-embroidery",
    slug: "embroidery",
    name: "Embroidery",
    description: "Fine threadwork finished by hand.",
    image: `${IMG}/category-embroidery.svg`,
    mobileImage: "",
    active: true,
    order: 2,
  },
  {
    id: "cat-cut-dana",
    slug: "cut-dana",
    name: "Cut-Dana Embroidery",
    description: "Sequinned cut-dana with a quiet lustre.",
    image: `${IMG}/category-cut-dana.svg`,
    mobileImage: "",
    active: true,
    order: 3,
  },
  {
    id: "cat-plain",
    slug: "plain",
    name: "Plain",
    description: "Clean cuts that let the fabric speak.",
    image: `${IMG}/category-plain.svg`,
    mobileImage: "",
    active: true,
    order: 4,
  },
  {
    id: "cat-unstitched",
    slug: "unstitched",
    name: "Unstitched",
    description: "Signature unstitched three-piece collections.",
    image: `${IMG}/category-unstitched.svg`,
    mobileImage: "",
    active: true,
    order: 5,
  },
  {
    id: "cat-lawn",
    slug: "lawn",
    name: "Lawn",
    description: "Featherlight lawn made for warmer days.",
    image: `${IMG}/category-lawn.svg`,
    mobileImage: "",
    active: true,
    order: 6,
  },
];

type FallbackProductSeed = Omit<
  Product,
  "stockQuantity" | "lowStockThreshold"
> &
  Partial<Pick<Product, "stockQuantity" | "lowStockThreshold">>;

const withStock = (p: FallbackProductSeed): Product => ({
  stockQuantity: 10,
  lowStockThreshold: 5,
  ...p,
});

const FALLBACK_PRODUCTS_SEED: FallbackProductSeed[] = [
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

const FALLBACK_PRODUCTS: Product[] = FALLBACK_PRODUCTS_SEED.map(withStock);

/* ---------------------------------------------------------------------------
 * DB → storefront type mapping
 * --------------------------------------------------------------------- */

function dbCategoryToStorefront(row: {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  image_url: string | null;
  mobile_image_url: string | null;
  is_active: boolean;
  sort_order: number;
}): Category {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? "",
    image: row.image_url ?? "",
    mobileImage: row.mobile_image_url ?? "",
    active: row.is_active,
    order: row.sort_order,
  };
}

function dbProductToStorefront(row: {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price: number;
  compare_at_price: number | null;
  image_url: string | null;
  fabric: string | null;
  embroidery: string | null;
  color: string | null;
  label: string | null;
  stock_quantity: number;
  low_stock_threshold: number;
  is_active: boolean;
  category_slug?: string | null;
}): Product {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? "",
    price: row.price,
    compareAtPrice: row.compare_at_price ?? undefined,
    image: row.image_url ?? "",
    categorySlug: row.category_slug ?? "uncategorized",
    fabric: row.fabric ?? undefined,
    embroidery: row.embroidery ?? undefined,
    color: row.color ?? undefined,
    label: row.label ?? undefined,
    stockQuantity: row.stock_quantity,
    lowStockThreshold: row.low_stock_threshold,
    active: row.is_active,
  };
}

/* ---------------------------------------------------------------------------
 * Async data accessors — DB-first, fallback-to-mock
 * --------------------------------------------------------------------- */

/** Flag: was the last read from the database? Downstream code can check this if needed. */
let lastReadFromDb = false;

export function isDbAvailable() {
  return lastReadFromDb;
}

const loadCategories = unstable_cache(
  async (): Promise<Category[]> => {
    try {
      const { listActiveCategories } =
        await import("@/services/categories/categories-service");
      const rows = await listActiveCategories();
      if (rows.length > 0) {
        lastReadFromDb = true;
        return rows.map(dbCategoryToStorefront);
      }
    } catch (e) {
      console.warn(
        "[storefront] categories DB read failed, falling back to static catalog:",
        e,
      );
    }
    lastReadFromDb = false;
    return FALLBACK_CATEGORIES.filter((c) => c.active).sort(
      (a, b) => a.order - b.order,
    );
  },
  ["storefront-active-categories"],
  { tags: [STORE_CACHE_TAGS.categories], revalidate: STORE_CACHE_TTL_SECONDS },
);

export async function getActiveCategories(): Promise<Category[]> {
  return loadCategories();
}

const loadCategoryBySlug = unstable_cache(
  async (slug: string): Promise<Category | null> => {
    try {
      const { getCategoryBySlug: fetchCategory } =
        await import("@/services/categories/categories-service");
      const row = await fetchCategory(slug);
      if (row) {
        lastReadFromDb = true;
        return dbCategoryToStorefront(row);
      }
    } catch (e) {
      console.warn(
        "[storefront] category slug DB read failed, falling back:",
        e,
      );
    }
    return FALLBACK_CATEGORIES.find((c) => c.slug === slug && c.active) ?? null;
  },
  ["storefront-category-by-slug"],
  { tags: [STORE_CACHE_TAGS.categories], revalidate: STORE_CACHE_TTL_SECONDS },
);

export async function getCategoryBySlug(
  slug: string,
): Promise<Category | null> {
  return loadCategoryBySlug(slug);
}

const loadAllActiveProducts = unstable_cache(
  async (): Promise<Product[]> => {
    try {
      const { listActiveProducts } =
        await import("@/services/products/products-service");
      const rows = await listActiveProducts({ limit: 50 });
      if (rows.length > 0) {
        lastReadFromDb = true;
        return rows.map((r) =>
          dbProductToStorefront({
            ...r,
            category_slug: r.category?.slug ?? null,
          }),
        );
      }
    } catch (e) {
      console.warn(
        "[storefront] products DB read failed, falling back to static catalog:",
        e,
      );
    }
    lastReadFromDb = false;
    return FALLBACK_PRODUCTS.filter((p) => p.active);
  },
  ["storefront-all-active-products"],
  { tags: [STORE_CACHE_TAGS.products], revalidate: STORE_CACHE_TTL_SECONDS },
);

export async function getAllActiveProducts(): Promise<Product[]> {
  return loadAllActiveProducts();
}

const loadProductsByCategory = unstable_cache(
  async (slug: string): Promise<Product[]> => {
    try {
      const { listActiveProducts } =
        await import("@/services/products/products-service");
      const rows = await listActiveProducts({ categorySlug: slug, limit: 50 });
      if (rows.length > 0) {
        lastReadFromDb = true;
        return rows.map((r) =>
          dbProductToStorefront({
            ...r,
            category_slug: r.category?.slug ?? slug,
          }),
        );
      }
    } catch (e) {
      console.warn(
        "[storefront] category products DB read failed, falling back:",
        e,
      );
    }
    return FALLBACK_PRODUCTS.filter((p) => p.categorySlug === slug && p.active);
  },
  ["storefront-products-by-category"],
  { tags: [STORE_CACHE_TAGS.products], revalidate: STORE_CACHE_TTL_SECONDS },
);

export async function getProductsByCategory(slug: string): Promise<Product[]> {
  return loadProductsByCategory(slug);
}

const loadNewArrivals = unstable_cache(
  async (limit = 4): Promise<Product[]> => {
    try {
      const { getNewArrivals: fetchNewArrivals } =
        await import("@/services/products/products-service");
      const rows = await fetchNewArrivals(limit);
      if (rows.length > 0) {
        lastReadFromDb = true;
        return rows.map((r) =>
          dbProductToStorefront({
            ...r,
            category_slug: r.category?.slug ?? null,
          }),
        );
      }
    } catch (e) {
      console.warn(
        "[storefront] new arrivals DB read failed, falling back:",
        e,
      );
    }
    lastReadFromDb = false;
    return FALLBACK_PRODUCTS.filter((p) => p.active).slice(0, limit);
  },
  ["storefront-new-arrivals"],
  { tags: [STORE_CACHE_TAGS.products], revalidate: STORE_CACHE_TTL_SECONDS },
);

export async function getNewArrivals(limit = 4): Promise<Product[]> {
  return loadNewArrivals(limit);
}

const loadProductById = unstable_cache(
  async (id: string): Promise<Product | null> => {
    try {
      const { getProductById: fetchProduct } =
        await import("@/services/products/products-service");
      const row = await fetchProduct(id);
      if (row) {
        lastReadFromDb = true;
        return dbProductToStorefront({
          ...row,
          category_slug: row.category?.slug ?? null,
        });
      }
    } catch (e) {
      console.warn("[storefront] product ID DB read failed, falling back:", e);
    }
    return FALLBACK_PRODUCTS.find((p) => p.id === id && p.active) ?? null;
  },
  ["storefront-product-by-id"],
  { tags: [STORE_CACHE_TAGS.products], revalidate: STORE_CACHE_TTL_SECONDS },
);

export async function getProductById(id: string): Promise<Product | null> {
  return loadProductById(id);
}

const loadProductBySlug = unstable_cache(
  async (slug: string): Promise<Product | null> => {
    try {
      const { getProductBySlug: fetchProduct } =
        await import("@/services/products/products-service");
      const row = await fetchProduct(slug);
      if (row) {
        lastReadFromDb = true;
        return dbProductToStorefront({
          ...row,
          category_slug: row.category?.slug ?? null,
        });
      }
    } catch (e) {
      console.warn(
        "[storefront] product slug DB read failed, falling back:",
        e,
      );
    }
    return FALLBACK_PRODUCTS.find((p) => p.slug === slug && p.active) ?? null;
  },
  ["storefront-product-by-slug"],
  { tags: [STORE_CACHE_TAGS.products], revalidate: STORE_CACHE_TTL_SECONDS },
);

export async function getProductBySlug(slug: string): Promise<Product | null> {
  return loadProductBySlug(slug);
}

export async function resolveProducts(
  ids: string[],
  limit = 4,
): Promise<Product[]> {
  const products: Product[] = [];
  for (const id of ids) {
    if (products.length >= limit) break;
    const p = await getProductById(id);
    if (p) products.push(p);
  }
  return products;
}

/* ---------------------------------------------------------------------------
 * Homepage product sections — derived from categories
 * --------------------------------------------------------------------- */

const SECTION_CONFIG = [
  {
    id: "section-new-arrivals",
    title: "New Arrivals",
    categorySlug: null as string | null,
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
    productIds: ["prod-sukoon", "prod-saada", "prod-rihla", "prod-naseem"],
  },
  {
    id: "section-unstitched",
    title: "Unstitched",
    categorySlug: "unstitched",
    productIds: ["prod-dastaan", "prod-mitti", "prod-hira", "prod-bagh"],
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
] satisfies ProductSection[];

export async function getActiveProductSections(): Promise<ProductSection[]> {
  return SECTION_CONFIG.filter((s) => s.productIds.length > 0);
}

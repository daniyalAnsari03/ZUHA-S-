/**
 * Storefront data-cache tags.
 *
 * Storefront reads (products, categories, CMS content) are wrapped in
 * `unstable_cache` so every storefront page served from the data cache instead
 * of hitting Supabase on each request. Admin/AI mutations revalidate the
 * matching tag through `revalidateTag`, and a short time-based TTL guards
 * against any mutation path that is missed.
 */
export const STORE_CACHE_TAGS = {
  products: "storefront:products",
  categories: "storefront:categories",
  cms: "storefront:cms",
} as const;

export const STORE_CACHE_TTL_SECONDS = 300;

/**
 * `cacheLife` profile passed as the second argument to `revalidateTag` in
 * Next 16. Purging a tag also (re)defines the lifetime of its freshly
 * recomputed entries; matching the storefront TTL keeps cache growth bounded.
 */
export const STORE_CACHE_PROFILE = { expire: STORE_CACHE_TTL_SECONDS } as const;
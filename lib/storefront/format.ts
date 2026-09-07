/**
 * Storefront formatting helpers. Keep presentation of values (prices, etc.)
 * centralized so business data is never formatted inline in components.
 */

const pkrFormatter = new Intl.NumberFormat("en-PK", {
  maximumFractionDigits: 0,
});

/** Format a number as a whole-PKR price, e.g. 34500 -> "PKR 34,500". */
export function formatPrice(amount: number): string {
  return `PKR ${pkrFormatter.format(amount)}`;
}

/** Slugify a category to a shop query/hash used for navigation. */
export function categoryHref(slug: string): string {
  return `/shop?category=${encodeURIComponent(slug)}`;
}
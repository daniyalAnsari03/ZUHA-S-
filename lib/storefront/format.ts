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

/**
 * Percentage the current price is below its compare-at/original price, rounded
 * to a whole usable number, or `null` when there is no legitimate discount to
 * show (missing/non-finite/zero compare-at, or compare-at not above price).
 */
export function discountPercent(
  price: number,
  compareAtPrice: number | null | undefined,
): number | null {
  if (
    typeof compareAtPrice !== "number" ||
    !Number.isFinite(compareAtPrice) ||
    compareAtPrice <= 0 ||
    compareAtPrice <= price
  ) {
    return null;
  }
  const percent = ((compareAtPrice - price) / compareAtPrice) * 100;
  if (!Number.isFinite(percent)) return null;
  const rounded = Math.round(percent);
  return rounded > 0 ? rounded : null;
}

/** Slugify a category to a shop query/hash used for navigation. */
export function categoryHref(slug: string): string {
  return `/shop?category=${encodeURIComponent(slug)}`;
}

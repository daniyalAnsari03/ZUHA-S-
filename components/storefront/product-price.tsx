import { discountPercent, formatPrice } from "@/lib/storefront/format";
import type { Product } from "@/lib/storefront/types";

import { cn } from "@/lib/utils";

type ProductPriceProps = {
  product: Product;
  /** Styles for the price line (selling-price size/color) in the current context. */
  className?: string;
  /** Element to render the price line as. */
  as?: "p" | "span";
  /** Light-on-dark secondary tones for use over imagery. */
  onDark?: boolean;
};

/**
 * Shared selling-price line. Shows the current price as the primary value and,
 * only when a valid higher compare-at price is present, the struck-through
 * original price and a dynamically calculated discount percentage.
 */
export function ProductPrice({
  product,
  className = "",
  as = "p",
  onDark = false,
}: ProductPriceProps) {
  const Tag = as;
  const percent = discountPercent(product.price, product.compareAtPrice);

  return (
    <Tag
      className={`inline-flex flex-wrap items-baseline gap-x-2 gap-y-0.5 ${className}`}
    >
      <span>{formatPrice(product.price)}</span>
      {percent !== null ? (
        <>
          <span
            className={cn(
              "text-xs line-through max-sm:text-[11px]",
              onDark ? "text-white/60" : "text-charcoal-muted",
            )}
          >
            {formatPrice(product.compareAtPrice!)}
          </span>
          <span
            className={cn(
              "text-[11px] font-semibold uppercase tracking-wide",
              onDark ? "text-gold-soft" : "text-plum",
            )}
          >
            {percent}% off
          </span>
        </>
      ) : null}
    </Tag>
  );
}
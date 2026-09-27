import Image from "next/image";
import Link from "next/link";

import { resolveImageUrl } from "@/lib/images";
import type { Product } from "@/lib/storefront/types";

import { AddToBagButton } from "./add-to-bag-button";
import { ProductPrice } from "./product-price";

type ProductCardProps = {
  product: Product;
  /**
   * Eagerly fetch the card image with `fetchpriority="high"` and a preload
   * hint. Only use this for cards that are inside the first viewport on every
   * breakpoint (currently the first row of the category grid) — everything
   * else stays lazy so it never competes with the LCP image for bandwidth.
   */
  priority?: boolean;
  /**
   * The `sizes` hint for the card image. It must describe the width the card
   * actually occupies at each breakpoint, because `next/image` uses it to pick
   * a candidate width — an over-wide hint wastes mobile bandwidth, an
   * under-wide one ships a soft image. Defaults to the horizontal homepage row.
   */
  sizes?: string;
};

/** Horizontal scroll row (homepage sections) and 4/3/2-column category grid. */
const CARD_SIZES_ROW =
  "(min-width: 1024px) 23vw, (min-width: 768px) 30vw, (min-width: 640px) 45vw, 62vw";
const CARD_SIZES_GRID = "(min-width: 1024px) 23vw, (min-width: 768px) 30vw, 45vw";

export const PRODUCT_CARD_SIZES = {
  row: CARD_SIZES_ROW,
  grid: CARD_SIZES_GRID,
} as const;

/**
 * Premium image-led product card: a consistent portrait ratio with the name,
 * fabric, price and a plum Add to Cart action overlaid on the image above a
 * soft dark-plum scrim, so it stays legible at every card width. Product pages
 * arrive when the product detail route exists.
 *
 * The card is used both in the horizontally scrollable homepage row (below
 * `sm`) and in category grids (2/3/4 columns from `sm` up), so the overlay
 * padding and type scale responsively instead of taking a layout variant prop.
 */
export function ProductCard({
  product,
  priority = false,
  sizes = CARD_SIZES_ROW,
}: ProductCardProps) {
  const href = `/product/${encodeURIComponent(product.slug)}`;

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-charcoal/10 bg-white">
      <Link
        href={href}
        className="block aspect-[3/4] overflow-hidden focus-visible:outline-plum"
        aria-label={`View ${product.name}`}
      >
        <Image
          src={
            resolveImageUrl(product.image) ||
            "/images/placeholders/product-placeholder.svg"
          }
          alt={product.name}
          width={800}
          height={1000}
          sizes={sizes}
          quality={50}
          {...(priority
            ? { priority: true, fetchPriority: "high" as const }
            : { loading: "lazy" as const, fetchPriority: "low" as const })}
          className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
        />
      </Link>

      {product.label ? (
        <span className="absolute left-3 top-3 z-10 rounded-full bg-white/90 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-plum backdrop-blur-sm max-sm:left-2 max-sm:top-2 max-sm:px-2 max-sm:text-[9px]">
          {product.label}
        </span>
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[75%] bg-gradient-to-t from-plum-dark/95 via-plum-dark/45 to-transparent" />

      <div className="absolute inset-x-0 bottom-0 z-10 px-3 pb-3 pt-10 sm:px-4 sm:pb-4">
        <Link
          href={href}
          className="font-serif text-[15px] leading-snug text-white transition-colors hover:text-gold-soft line-clamp-2 sm:text-base"
        >
          {product.name}
        </Link>
        {product.fabric ? (
          <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-gold-soft sm:text-[11px]">
            {product.fabric}
          </p>
        ) : null}
        <ProductPrice
          product={product}
          onDark
          className="mt-1.5 text-[13px] font-medium text-white sm:text-sm"
        />
        <AddToBagButton
          productId={product.id}
          size="sm"
          onDark
          className="mt-2 sm:mt-3"
        />
      </div>
    </article>
  );
}

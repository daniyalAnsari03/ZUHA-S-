import Image from "next/image";
import Link from "next/link";

import { resolveImageUrl } from "@/lib/images";
import type { Product } from "@/lib/storefront/types";

import { AddToBagButton } from "./add-to-bag-button";
import { ProductPrice } from "./product-price";

type ProductCardProps = {
  product: Product;
  /**
   * Apply a compact mobile sizing variant (used by the single-product mobile
   * carousel). Only affects screens below `sm`; desktop/tablet and default
   * card sizing are unchanged.
   */
  compact?: boolean;
};

/**
 * Premium image-led product card: a consistent portrait ratio with the name,
 * fabric, price and a plum Add to Cart action overlaid on the image above a
 * soft dark-plum scrim, so it stays legible at every card width. Product pages
 * arrive when the product detail route exists.
 */
export function ProductCard({ product, compact = false }: ProductCardProps) {
  const href = `/product/${encodeURIComponent(product.slug)}`;
  const compactClasses = compact ? " max-sm:px-3 max-sm:pb-3" : "";

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
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
        />
      </Link>

      {product.label ? (
        <span className="absolute left-3 top-3 z-10 rounded-full bg-white/90 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-plum backdrop-blur-sm max-sm:left-2 max-sm:top-2 max-sm:px-2 max-sm:text-[9px]">
          {product.label}
        </span>
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[75%] bg-gradient-to-t from-plum-dark/95 via-plum-dark/45 to-transparent" />

      <div
        className={`absolute inset-x-0 bottom-0 z-10 px-4 pb-4 pt-10${compactClasses}`}
      >
        <Link
          href={href}
          className="font-serif text-base leading-snug text-white transition-colors hover:text-gold-soft line-clamp-2 max-sm:text-[15px]"
        >
          {product.name}
        </Link>
        {product.fabric ? (
          <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-gold-soft max-sm:text-[10px]">
            {product.fabric}
          </p>
        ) : null}
        <ProductPrice
          product={product}
          onDark
          className="mt-1.5 text-sm font-medium text-white max-sm:text-[13px]"
        />
        <AddToBagButton
          productId={product.id}
          size="sm"
          onDark
          className="mt-3 max-sm:mt-2"
        />
      </div>
    </article>
  );
}
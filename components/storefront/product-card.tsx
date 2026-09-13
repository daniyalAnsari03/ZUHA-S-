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
 * Premium product card: image-led, clean spacing, price and a dark-plum Add
 * to Bag action. Product pages arrive when the product detail route exists.
 */
export function ProductCard({ product, compact = false }: ProductCardProps) {
  const href = `/product/${encodeURIComponent(product.slug)}`;
  const compactClasses = compact
    ? " max-sm:px-3 max-sm:pt-3 max-sm:pb-3"
    : "";

  return (
    <article className="group flex flex-col rounded-2xl border border-charcoal/10 bg-white">
      <div className="relative overflow-hidden rounded-t-2xl">
        <Link
          href={href}
          className="block aspect-[4/5] overflow-hidden focus-visible:outline-plum max-sm:aspect-square"
          aria-label={`View ${product.name}`}
        >
          <Image
            src={resolveImageUrl(product.image) || "/images/placeholders/product-placeholder.svg"}
            alt={product.name}
            width={800}
            height={1000}
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
          />
        </Link>
        {product.label ? (
          <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-plum max-sm:left-2 max-sm:top-2 max-sm:px-2 max-sm:text-[9px]">
            {product.label}
          </span>
        ) : null}
      </div>

      <div className={`flex flex-1 flex-col px-4 pt-4 pb-4${compactClasses}`}>
        <Link
          href={href}
          className="font-serif text-base leading-snug text-charcoal transition-colors hover:text-plum max-sm:text-[15px]"
        >
          {product.name}
        </Link>
        {product.fabric ? (
          <p className="mt-1 text-xs uppercase tracking-wide text-charcoal-muted max-sm:text-[11px]">
            {product.fabric}
          </p>
        ) : null}
        <ProductPrice
          product={product}
          className="mt-1 text-sm font-medium text-charcoal max-sm:text-[13px]"
        />
        <AddToBagButton
          productId={product.id}
          className="mt-4 h-10 text-sm max-sm:mt-3 max-sm:h-9 max-sm:text-[13px]"
        />
      </div>
    </article>
  );
}
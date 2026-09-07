import Image from "next/image";
import Link from "next/link";

import { categoryHref, formatPrice } from "@/lib/storefront/format";
import type { Product } from "@/lib/storefront/types";

import { AddToBagButton } from "./add-to-bag-button";

type ProductCardProps = {
  product: Product;
};

/**
 * Premium product card: image-led, clean spacing, price and a dark-plum Add
 * to Bag action. Product pages/catalog management arrive in a later phase, so
 * artwork links to the matching shop category.
 */
export function ProductCard({ product }: ProductCardProps) {
  const href = categoryHref(product.categorySlug);

  return (
    <article className="group flex flex-col">
      <div className="relative overflow-hidden rounded-2xl border border-charcoal/10 bg-white shadow-[0_8px_24px_-18px_rgba(43,38,34,0.4)]">
        <Link
          href={href}
          className="block aspect-[4/5] overflow-hidden focus-visible:outline-plum"
          aria-label={`View ${product.name}`}
        >
          <Image
            src={product.image}
            alt={product.name}
            width={800}
            height={1000}
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
          />
        </Link>
        {product.label ? (
          <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-plum">
            {product.label}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col pt-4">
        <Link
          href={href}
          className="font-serif text-base leading-snug text-charcoal transition-colors hover:text-plum"
        >
          {product.name}
        </Link>
        {product.fabric ? (
          <p className="mt-1 text-xs uppercase tracking-wide text-charcoal-muted">
            {product.fabric}
          </p>
        ) : null}
        <p className="mt-1 text-sm font-medium text-charcoal">
          {formatPrice(product.price)}
        </p>
        <AddToBagButton
          productName={product.name}
          className="mt-4 h-10 rounded-full text-sm"
        />
      </div>
    </article>
  );
}
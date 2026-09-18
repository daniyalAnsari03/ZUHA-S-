"use client";

import type { Product } from "@/lib/storefront/types";

import { ProductCard } from "./product-card";

type ProductCarouselProps = {
  products: Product[];
};

/**
 * Mobile-only horizontal swipe/drag carousel for homepage product sections.
 * Shows exactly one product at a time; the user swipes/drags to move between
 * products. Hidden on `sm` and up, where the existing static grid takes over.
 * Reuses the standard `ProductCard`.
 */
export function ProductCarousel({ products }: ProductCarouselProps) {
  if (products.length === 0) return null;

  return (
    <div className="mt-8 -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {products.map((product) => (
        <div
          key={product.id}
          className="w-[60%] min-w-0 shrink-0 snap-start max-[360px]:w-[68%]"
        >
          <ProductCard product={product} compact />
        </div>
      ))}
    </div>
  );
}

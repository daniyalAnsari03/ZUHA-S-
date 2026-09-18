"use client";

import Image from "next/image";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { motion, type Variants } from "framer-motion";
import { useMemo, useState } from "react";

import { resolveImageUrl } from "@/lib/images";
import type { Category, Product } from "@/lib/storefront/types";

import { ProductPrice } from "./product-price";

type SearchPanelProps = {
  products: Product[];
  categories: Category[];
  onNavigate: () => void;
};

const MotionLink = motion.create(Link);

const easing: [number, number, number, number] = [0.22, 1, 0.36, 1];

const listVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: easing } },
};

function categoryName(categories: Category[], slug: string): string {
  return categories.find((c) => c.slug === slug)?.name ?? slug;
}

/**
 * Client-side search entry point over the Phase 2 mock catalog. Search is not
 * wired to a backend yet; it filters the local catalog honestly and clearly.
 * Results cascade in with a soft stagger and lift on hover.
 */
export function SearchPanel({ products, categories, onNavigate }: SearchPanelProps) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return { searched: false, items: [] as Product[] };
    const items = products.filter((p) =>
      [p.name, p.description, categoryName(categories, p.categorySlug), p.categorySlug]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
    return { searched: true, items };
  }, [query, products, categories]);

  return (
    <motion.div
      variants={listVariants}
      className="flex flex-col gap-5 px-5 py-6 sm:px-6"
    >
      <motion.div variants={itemVariants} className="group relative">
        <label htmlFor="storefront-search" className="sr-only">
          Search products
        </label>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-muted transition-colors group-focus-within:text-plum"
        />
        <input
          id="storefront-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search product, category…"
          data-autofocus
          className="h-12 w-full rounded-full border border-charcoal/15 bg-white pl-11 pr-11 text-sm text-charcoal transition-shadow placeholder:text-charcoal-muted/60 focus:border-plum focus:outline-none focus:ring-4 focus:ring-plum/10"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-charcoal-muted transition-colors hover:bg-plum/5 hover:text-plum"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </motion.div>

      {!results.searched ? (
        <motion.div
          variants={itemVariants}
          className="flex flex-col items-center gap-3 px-6 py-12 text-center"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-plum/5 text-plum">
            <Search className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="text-sm text-charcoal-muted">
            Start typing to search the collection — product names, categories and
            descriptions.
          </p>
        </motion.div>
      ) : results.items.length === 0 ? (
        <motion.p
          variants={itemVariants}
          className="px-2 py-10 text-center text-sm text-charcoal-muted"
        >
          No products match “{query}”. Try a different name or category.
        </motion.p>
      ) : (
        <motion.ul
          variants={listVariants}
          className="flex flex-col divide-y divide-charcoal/10"
        >
          {results.items.slice(0, 8).map((product) => (
            <motion.li key={product.id} variants={itemVariants}>
              <MotionLink
                href={`/product/${encodeURIComponent(product.slug)}`}
                onClick={onNavigate}
                className="group flex items-center gap-4 py-3"
              >
                <span className="relative h-16 w-14 shrink-0 overflow-hidden rounded-lg bg-cream">
                  <Image
                    src={resolveImageUrl(product.image) || "/images/placeholders/product-placeholder.svg"}
                    alt=""
                    width={112}
                    height={128}
                    sizes="56px"
                    className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-serif text-sm text-charcoal transition-colors group-hover:text-plum">
                    {product.name}
                  </span>
                  <span className="block text-xs uppercase tracking-wide text-charcoal-muted">
                    {categoryName(categories, product.categorySlug)}
                  </span>
                </span>
                <ProductPrice
                  product={product}
                  as="span"
                  className="shrink-0 text-sm text-charcoal"
                />
              </MotionLink>
            </motion.li>
          ))}
        </motion.ul>
      )}
    </motion.div>
  );
}

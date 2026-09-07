"use client";

import Image from "next/image";
import Link from "next/link";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { formatPrice } from "@/lib/storefront/format";
import type { Category, Product } from "@/lib/storefront/types";

type SearchPanelProps = {
  products: Product[];
  categories: Category[];
  onNavigate: () => void;
};

function categoryName(categories: Category[], slug: string): string {
  return categories.find((c) => c.slug === slug)?.name ?? slug;
}

/**
 * Client-side search entry point over the Phase 2 mock catalog. Search is not
 * wired to a backend yet; it filters the local catalog honestly and clearly.
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
    <div className="flex flex-col gap-5 px-5 py-6 sm:px-6">
      <div className="relative">
        <label htmlFor="storefront-search" className="sr-only">
          Search products
        </label>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-muted"
        />
        <input
          id="storefront-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search product, category…"
          data-autofocus
          className="h-12 w-full rounded-full border border-charcoal/15 bg-white pl-11 pr-4 text-sm text-charcoal placeholder:text-charcoal-muted/60 focus:border-plum focus:outline-none focus:ring-2 focus:ring-plum/15"
        />
      </div>

      {!results.searched ? (
        <p className="text-sm text-charcoal-muted">
          Start typing to search the collection — product names, categories and
          descriptions.
        </p>
      ) : results.items.length === 0 ? (
        <p className="text-sm text-charcoal-muted">
          No products match “{query}”. Try a different name or category.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-charcoal/10">
          {results.items.slice(0, 8).map((product) => (
            <li key={product.id}>
              <Link
                href={`/product/${encodeURIComponent(product.slug)}`}
                onClick={onNavigate}
                className="group flex items-center gap-4 py-3"
              >
                <span className="relative h-16 w-14 shrink-0 overflow-hidden rounded-lg bg-cream">
                  <Image
                    src={product.image}
                    alt=""
                    width={112}
                    height={128}
                    sizes="56px"
                    className="h-full w-full object-cover"
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-serif text-sm text-charcoal group-hover:text-plum">
                    {product.name}
                  </span>
                  <span className="block text-xs uppercase tracking-wide text-charcoal-muted">
                    {categoryName(categories, product.categorySlug)}
                  </span>
                </span>
                <span className="shrink-0 text-sm text-charcoal">
                  {formatPrice(product.price)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
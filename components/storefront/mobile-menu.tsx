import Link from "next/link";

import { categoryHref } from "@/lib/storefront/format";
import type { Category } from "@/lib/storefront/types";

type MobileMenuProps = {
  onNavigate: () => void;
  categories: Category[];
};

/**
 * Navigation drawer content. Categories come from the storefront data layer
 * (future admin-controlled) and close the drawer on navigation.
 */
export function MobileMenu({ onNavigate, categories }: MobileMenuProps) {
  return (
    <div className="flex flex-col gap-8 px-5 py-6 sm:px-6">
      <nav aria-label="Shop" className="flex flex-col">
        <Link
          href="/shop"
          onClick={onNavigate}
          className="flex items-center justify-between border-b border-charcoal/10 py-3.5 font-serif text-base text-charcoal transition-colors hover:text-plum"
        >
          Shop All
        </Link>
        <Link
          href="/#section-new-arrivals"
          onClick={onNavigate}
          className="flex items-center justify-between border-b border-charcoal/10 py-3.5 font-serif text-base text-charcoal transition-colors hover:text-plum"
        >
          New Arrivals
        </Link>
        {categories.map((category) => (
          <Link
            key={category.id}
            href={categoryHref(category.slug)}
            onClick={onNavigate}
            className="flex items-center justify-between border-b border-charcoal/10 py-3.5 font-serif text-base text-charcoal transition-colors hover:text-plum"
          >
            {category.name}
            <span aria-hidden="true" className="text-plum">
              →
            </span>
          </Link>
        ))}
      </nav>

      <div className="text-xs leading-relaxed text-charcoal-muted">
        <p>Premium Pakistani fashion — crafted details, considered design.</p>
        <a
          href="mailto:care@dinsbydaniyal.com"
          className="mt-1 inline-block text-plum hover:underline"
        >
          care@dinsbydaniyal.com
        </a>
      </div>
    </div>
  );
}
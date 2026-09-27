"use client";

import Link from "next/link";

import { categoryHref } from "@/lib/storefront/format";
import type { Category } from "@/lib/storefront/types";

type MobileMenuProps = {
  onNavigate: () => void;
  categories: Category[];
};

const rowClass =
  "group flex items-center justify-between gap-3 border-b border-charcoal/10 py-3.5 font-serif text-base text-charcoal transition-colors hover:text-plum";
const arrowClass =
  "text-plum transition-transform duration-300 ease-out group-hover:translate-x-1.5";

/**
 * Navigation drawer content. Categories come from the storefront data layer
 * (future admin-controlled) and close the drawer on navigation. Rows cascade in
 * with a staggered motion and lift an arrow on hover for a premium feel.
 * Account/profile actions are accessed via the navbar account icon dropdown,
 * not in the mobile menu.
 *
 * The entrance is CSS (`stagger-in` / `--stagger-i`) rather than a JavaScript
 * animation library. The drawer is opened from the navbar, which is in the
 * first viewport of every storefront page, so a JS animation runtime here was
 * pure first-load cost for an effect that only ever runs on interaction.
 */
export function MobileMenu({ onNavigate, categories }: MobileMenuProps) {
  const shopItems = [
    { href: "/shop", label: "Shop All" },
    { href: "/#section-new-arrivals", label: "New Arrivals" },
    ...categories.map((category) => ({
      href: categoryHref(category.slug),
      label: category.name,
    })),
  ];

  return (
    <div className="flex flex-col gap-8 px-5 py-6 sm:px-6">
      <nav aria-label="Shop" className="flex flex-col">
        {shopItems.map((item, index) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`stagger-in ${rowClass}`}
            style={{ "--stagger-i": index } as React.CSSProperties}
          >
            <span className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="font-sans text-[10px] tracking-[0.2em] text-charcoal-muted/60"
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              {item.label}
            </span>
            <span aria-hidden="true" className={arrowClass}>
              →
            </span>
          </Link>
        ))}
      </nav>

      <div className="stagger-in text-xs leading-relaxed text-charcoal-muted">
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

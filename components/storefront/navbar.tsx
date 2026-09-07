"use client";

import Link from "next/link";
import { Heart, Menu, Search, ShoppingBag } from "lucide-react";
import { useState } from "react";

import type { Category, Product } from "@/lib/storefront/types";

import { MobileMenu } from "./mobile-menu";
import { SearchPanel } from "./search-panel";
import { SlideOver } from "./slide-over";
import { UtilityPanel } from "./utility-panel";

type NavbarProps = {
  categories: Category[];
  products: Product[];
};

type PanelId = "menu" | "search" | "wishlist" | "cart" | null;

/**
 * Premium storefront navbar. Locked layout: hamburger (left), brand wordmark
 * (center), search / wishlist / cart entry points (right).
 */
export function Navbar({ categories, products }: NavbarProps) {
  const [panel, setPanel] = useState<PanelId>(null);
  const close = () => setPanel(null);

  return (
    <header className="sticky top-0 z-40 border-b border-charcoal/10 bg-white/90 backdrop-blur-md">
      <nav
        aria-label="Primary"
        className="mx-auto grid h-16 max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 sm:h-20 sm:px-6 lg:px-8"
      >
        <div className="justify-self-start">
          <button
            type="button"
            onClick={() => setPanel("menu")}
            aria-label="Open menu"
            aria-expanded={panel === "menu"}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-charcoal transition-colors hover:bg-plum/5 focus-visible:outline-plum"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <Link
          href="/"
          className="justify-self-center font-serif text-lg tracking-wide text-charcoal sm:text-xl"
        >
          dINS<sup className="mr-0.5 text-[0.55em]">®</sup>
          <span className="hidden text-sm sm:inline"> by Daniyal</span>
        </Link>

        <div className="flex items-center justify-self-end gap-0.5 sm:gap-1">
          <button
            type="button"
            onClick={() => setPanel("search")}
            aria-label="Search"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-charcoal transition-colors hover:bg-plum/5 focus-visible:outline-plum"
          >
            <Search className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setPanel("wishlist")}
            aria-label="Wishlist"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-charcoal transition-colors hover:bg-plum/5 focus-visible:outline-plum"
          >
            <Heart className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setPanel("cart")}
            aria-label="Cart"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-charcoal transition-colors hover:bg-plum/5 focus-visible:outline-plum"
          >
            <ShoppingBag className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </nav>

      <SlideOver
        open={panel === "menu"}
        onClose={close}
        title="Shop"
        side="left"
        labelledById="menu-panel-title"
      >
        <MobileMenu onNavigate={close} categories={categories} />
      </SlideOver>

      <SlideOver
        open={panel === "search"}
        onClose={close}
        title="Search"
        side="right"
      >
        <SearchPanel
          products={products}
          categories={categories}
          onNavigate={close}
        />
      </SlideOver>

      <SlideOver
        open={panel === "wishlist"}
        onClose={close}
        title="Wishlist"
        side="right"
      >
        <UtilityPanel variant="wishlist" />
      </SlideOver>

      <SlideOver
        open={panel === "cart"}
        onClose={close}
        title="Your Bag"
        side="right"
      >
        <UtilityPanel variant="cart" />
      </SlideOver>
    </header>
  );
}
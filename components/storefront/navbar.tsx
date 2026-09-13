"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Heart, Menu, Search, ShoppingBag } from "lucide-react";
import { useState } from "react";

import type { Category, Product } from "@/lib/storefront/types";

import { MobileMenu } from "./mobile-menu";
import { SearchPanel } from "./search-panel";
import { SlideOver } from "./slide-over";
import { CartPanel } from "./cart-panel";
import { WishlistPanel } from "./wishlist-panel";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { useStorefront } from "./storefront-provider";

type NavbarProps = {
  categories: Category[];
  products: Product[];
};

type PanelId = "menu" | "search" | "wishlist" | "cart" | null;

/**
 * Premium storefront navbar. Locked layout: hamburger (left), brand wordmark
 * (center), search / wishlist / cart entry points (right). Cart and wishlist
 * counts are live and drive the badge indicators.
 */
export function Navbar({ categories, products }: NavbarProps) {
  const [panel, setPanel] = useState<PanelId>(null);
  const close = () => setPanel(null);
  const isHome = usePathname() === "/";
  const { cartCount, wishlistCount } = useStorefront();
  const iconButtonClass = isHome
    ? "inline-flex h-10 w-10 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10 focus-visible:outline-white"
    : "inline-flex h-10 w-10 items-center justify-center rounded-full text-charcoal transition-colors hover:bg-plum/5 focus-visible:outline-plum";

  return (
    <header className="sticky top-0 z-40 bg-transparent">
      <nav
        aria-label="Primary"
        className="mx-auto grid h-32 max-w-7xl grid-cols-[1fr_auto_1fr] items-start gap-2 px-4 pt-3 sm:h-40 sm:px-6 sm:pt-4 lg:px-8"
      >
        <div className="justify-self-start">
          <button
            type="button"
            onClick={() => setPanel("menu")}
            aria-label="Open menu"
            aria-expanded={panel === "menu"}
            className={iconButtonClass}
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <Link href="/" className="justify-self-center">
          <Image
            src={
              isHome
                ? "/images/brand/dins-by-daniyal-logo-white.png"
                : "/images/brand/dins-by-daniyal-logo.png"
            }
            alt="dINS by Daniyal"
            width={408}
            height={214}
            priority
            className="h-[58px] w-auto sm:h-[69px]"
          />
        </Link>

        <div className="flex items-center justify-self-end gap-0.5 sm:gap-1">
          <button
            type="button"
            onClick={() => setPanel("search")}
            aria-label="Search"
            className={iconButtonClass}
          >
            <Search className="h-4 w-4" aria-hidden="true" />
          </button>
          <NotificationBell iconButtonClass={iconButtonClass} />
          <button
            type="button"
            onClick={() => setPanel("wishlist")}
            aria-label={`Wishlist${wishlistCount > 0 ? `, ${wishlistCount} saved` : ""}`}
            className={`relative ${iconButtonClass}`}
          >
            <Heart className="h-4 w-4" aria-hidden="true" />
            {wishlistCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-plum px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-white">
                {wishlistCount > 99 ? "99+" : wishlistCount}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => setPanel("cart")}
            aria-label={`Cart${cartCount > 0 ? `, ${cartCount} items` : ""}`}
            className={`relative ${iconButtonClass}`}
          >
            <ShoppingBag className="h-4 w-4" aria-hidden="true" />
            {cartCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-plum px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-white">
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            ) : null}
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
        <WishlistPanel />
      </SlideOver>

      <SlideOver
        open={panel === "cart"}
        onClose={close}
        title="Your Bag"
        side="right"
      >
        <CartPanel />
      </SlideOver>
    </header>
  );
}
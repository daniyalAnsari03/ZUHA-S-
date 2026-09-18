"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Handbag, Menu, Search, User } from "lucide-react";
import { useEffect, useState } from "react";

import type { Category, Product } from "@/lib/storefront/types";

import { MobileMenu } from "./mobile-menu";
import { NavIcon } from "./nav-icon-button";
import { SearchPanel } from "./search-panel";
import { SlideOver } from "./slide-over";
import { CartPanel } from "./cart-panel";
import { useStorefront } from "./storefront-provider";

type NavbarProps = {
  categories: Category[];
  products: Product[];
};

type PanelId = "menu" | "search" | "cart" | null;

/**
 * Premium storefront navbar. Locked layout: hamburger (left), brand wordmark
 * (center), search / login-account / bag entry points (right). Cart and login
 * entries live in the navbar; wishlist and notifications live elsewhere.
 */
export function Navbar({ categories, products }: NavbarProps) {
  const [panel, setPanel] = useState<PanelId>(null);
  const [scrolled, setScrolled] = useState(false);
  const close = () => setPanel(null);
  const isHome = usePathname() === "/";
  const { cartCount } = useStorefront();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const solid = scrolled || !isHome;
  const tone = solid ? "light" : "dark";
  const iconButtonClass = solid
    ? "h-10 w-10 items-center justify-center rounded-full border border-plum/10 bg-gradient-to-b from-white to-plum/[0.06] text-plum shadow-sm shadow-plum/5 transition-all duration-300 hover:border-plum/25 hover:from-plum/10 hover:to-plum/10 hover:text-plum-dark focus-visible:outline-plum"
    : "h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-gold-soft shadow-sm shadow-black/10 backdrop-blur-md transition-all duration-300 hover:border-white/35 hover:bg-white/20 hover:text-white focus-visible:outline-white";

  return (
    <header className="sticky top-0 z-40">
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 top-0 h-[70px] transition-opacity duration-300 sm:h-[85px] ${
          scrolled
            ? "bg-gold-soft/90 opacity-100 shadow-[0_6px_24px_-12px_rgba(74,32,64,0.25)] backdrop-blur-md"
            : "opacity-0"
        }`}
      />
      <nav
        aria-label="Primary"
        className="relative mx-auto grid h-32 max-w-7xl grid-cols-[1fr_auto_1fr] items-start gap-2 px-4 pt-3 sm:h-40 sm:px-6 sm:pt-4 lg:px-8"
      >
        <div className="flex items-center justify-self-start gap-0.5 sm:gap-1">
          <NavIcon
            label="Open menu"
            effect="menu"
            tone={tone}
            expanded={panel === "menu"}
            onClick={() => setPanel("menu")}
            className={`inline-flex ${iconButtonClass}`}
            icon={<Menu className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />}
          />
          <NavIcon
            label="Search"
            effect="search"
            tone={tone}
            delay={0.05}
            onClick={() => setPanel("search")}
            className={`inline-flex lg:hidden ${iconButtonClass}`}
            icon={<Search className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden="true" />}
          />
        </div>

        <Link
          href="/"
          aria-label="DINS by Daniyal"
          className="justify-self-center"
        >
          <span
            aria-hidden="true"
            className="block h-[58px] w-[111px] transition-[filter] duration-500 sm:h-[69px] sm:w-[132px]"
            style={{
              backgroundImage: scrolled
                ? "linear-gradient(135deg, #ffffff 0%, #ffffff 100%)"
                : isHome
                  ? "linear-gradient(135deg, #f3e5c0 0%, #dcc188 38%, #c2a668 66%, #9a7c42 100%)"
                  : "linear-gradient(135deg, #3a1833 0%, #4a2040 45%, #7a3570 72%, #b89b63 118%)",
              WebkitMaskImage:
                "url('/images/brand/dins-by-daniyal-logo-white.png')",
              maskImage:
                "url('/images/brand/dins-by-daniyal-logo-white.png')",
              WebkitMaskRepeat: "no-repeat",
              maskRepeat: "no-repeat",
              WebkitMaskSize: "contain",
              maskSize: "contain",
              WebkitMaskPosition: "center",
              maskPosition: "center",
              filter: scrolled
                ? "drop-shadow(0 2px 8px rgba(74,32,64,0.28))"
                : isHome
                  ? "drop-shadow(0 2px 10px rgba(0,0,0,0.35))"
                  : "drop-shadow(0 2px 8px rgba(74,32,64,0.18))",
            }}
          />
        </Link>

        <div className="flex items-center justify-self-end gap-0.5 sm:gap-1">
          <NavIcon
            label="Search"
            effect="search"
            tone={tone}
            delay={0.1}
            onClick={() => setPanel("search")}
            className={`hidden lg:inline-flex ${iconButtonClass}`}
            icon={<Search className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden="true" />}
          />
          <NavIcon
            label="Login / My Account"
            effect="account"
            tone={tone}
            delay={0.15}
            href="/account"
            className={`inline-flex ${iconButtonClass}`}
            icon={<User className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden="true" />}
          />
          <NavIcon
            label={`Cart${cartCount > 0 ? `, ${cartCount} items` : ""}`}
            effect="bag"
            tone={tone}
            delay={0.2}
            onClick={() => setPanel("cart")}
            className={`inline-flex ${iconButtonClass}`}
            icon={<Handbag className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden="true" />}
            badge={
              cartCount > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 z-20 flex h-4 min-w-4 items-center justify-center rounded-full bg-plum px-1 text-[10px] font-semibold leading-none text-white shadow-sm shadow-plum/30 ring-2 ring-white">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              ) : null
            }
          />
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
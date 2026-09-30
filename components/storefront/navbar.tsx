"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Handbag, Menu, Search, User, LogOut } from "lucide-react";
import { useEffect, useState } from "react";

import type { Category, Product } from "@/lib/storefront/types";

import { NavIcon } from "./nav-icon-button";
import { SlideOver } from "./slide-over";
import { MobileMenu } from "./mobile-menu";
import { SearchPanel } from "./search-panel";
import { CartPanel } from "./cart-panel";
import { useStorefront } from "./storefront-provider";
import { signOutClient } from "@/lib/auth/client-signout";

/**
 * Drawer bodies are imported directly. They used to be wrapped in
 * `next/dynamic`, but they only ever ran a JavaScript animation library, which
 * is what put ~130KB of animation code on the critical path of every storefront
 * page. With the entrance now expressed in CSS they are cheap enough to import
 * normally, so the drawer also opens with its content already there.
 */

type NavbarProps = {
  categories: Category[];
  products: Product[];
};

type PanelId = "menu" | "search" | "cart" | null;

type AccountState = "signedOut" | "signedIn" | "admin";

/**
 * Premium storefront navbar. Locked layout: hamburger (left), brand wordmark
 * (center), search / login-account / bag entry points (right). Cart and login
 * entries live in the navbar; wishlist and notifications live elsewhere.
 * When logged in, the account icon opens a dropdown with account actions.
 */
export function Navbar({ categories, products }: NavbarProps) {
  const router = useRouter();
  const [panel, setPanel] = useState<PanelId>(null);
  // Initialize scrolled state correctly on mount to prevent color flash
  const [scrolled, setScrolled] = useState(() => {
    if (typeof window !== "undefined") {
      return window.scrollY > 12;
    }
    return false;
  });
  const [accountState, setAccountState] = useState<AccountState>("signedOut");
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const close = () => setPanel(null);
  const isHome = usePathname() === "/";
  const { cartCount } = useStorefront();

  // Detect auth state on mount. This asks the server, which already holds a
  // Supabase session client, instead of constructing one in the browser —
  // importing the browser Supabase SDK here added a large client-side dependency
  // to every storefront page for a single account-state lookup.
  useEffect(() => {
    let active = true;

    async function detectSession() {
      try {
        const response = await fetch("/api/session", {
          credentials: "same-origin",
          headers: { accept: "application/json" },
        });
        if (!response.ok) throw new Error("session lookup failed");
        const data = (await response.json()) as {
          state?: "signedOut" | "signedIn" | "admin";
        };
        if (active && data.state) setAccountState(data.state);
      } catch {
        if (active) setAccountState("signedOut");
      }
    }

    detectSession();

    return () => {
      active = false;
    };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const accountButton = document.querySelector('[data-account-button]');
      const dropdown = document.querySelector('[data-account-dropdown]');
      if (
        accountDropdownOpen &&
        accountButton &&
        dropdown &&
        !accountButton.contains(target) &&
        !dropdown.contains(target)
      ) {
        setAccountDropdownOpen(false);
      }
    }

    if (accountDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [accountDropdownOpen]);

  // Initialize scroll state synchronously on mount and listen for scroll
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    // Set initial state immediately (useLayoutEffect would be ideal but useEffect with synchronous call works)
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const solid = scrolled || !isHome;
  const tone = solid ? "light" : "dark";
  // 44x44 on touch widths so the icon controls meet the 44px tap-target
  // guideline; the pointer-sized 40x40 circle is kept from `sm` up so tablet and
  // desktop keep their existing density. The navbar is far taller than either
  // (h-32 / h-40), so this grows the hit area without moving the layout.
  const iconButtonBase =
    "h-11 w-11 sm:h-10 sm:w-10 items-center justify-center rounded-full transition-all duration-300";
  // Homepage: the icons sit directly on the dark hero, so the locked treatment
  // is plain white with no chip, no border and no shadow. Once the bar turns
  // solid they drop to plum, where white would no longer be readable. Every
  // other route keeps the existing bordered chip.
  const iconButtonClass = isHome
    ? scrolled
      ? `${iconButtonBase} border-0 bg-transparent text-plum hover:bg-plum/5 hover:text-plum-dark focus-visible:outline-plum`
      : `${iconButtonBase} border-0 bg-transparent text-white hover:bg-white/10 hover:text-white focus-visible:outline-white`
    : `${iconButtonBase} border border-plum/10 bg-gradient-to-b from-white to-plum/[0.06] text-plum shadow-sm shadow-plum/5 hover:border-plum/25 hover:from-plum/10 hover:to-plum/10 hover:text-plum-dark focus-visible:outline-plum`;

  const handleAccountClick = () => {
    if (accountState === "signedOut") {
      router.push("/login");
    } else {
      setAccountDropdownOpen((prev) => !prev);
    }
  };

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
        // Top padding reserves the 36px announcement overlay that sits on top of
        // this bar, so the two never overlap. Keep the two heights in step.
        className="relative mx-auto grid h-32 max-w-7xl grid-cols-[1fr_auto_1fr] items-start gap-2 px-4 pt-12 sm:h-40 sm:px-6 sm:pt-[52px] lg:px-8"
      >
        <div className="flex items-center justify-self-start gap-0.5 sm:gap-1">
          <NavIcon
            label="Open menu"
            effect="menu"
            tone={tone}
            expanded={panel === "menu"}
            onClick={() => setPanel("menu")}
            className={`inline-flex ${iconButtonClass}`}
            icon={
              <Menu className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
            }
          />
          <NavIcon
            label="Search"
            effect="search"
            tone={tone}
            delay={0.05}
            onClick={() => setPanel("search")}
            className={`inline-flex lg:hidden ${iconButtonClass}`}
            icon={
              <Search
                className="h-[18px] w-[18px]"
                strokeWidth={1.75}
                aria-hidden="true"
              />
            }
          />
        </div>

        <Link
          href="/"
          aria-label={isHome ? "ZUHA'S — home" : "DINS by Daniyal"}
          className="justify-self-center"
        >
          {isHome ? (
            // Homepage wordmark. The hero behind the navbar is dark, so the
            // locked brand colour here is white; it only drops to plum once the
            // bar turns solid, where white would no longer be readable.
            // The box matches the icon control height (h-11 / sm:h-10) and
            // centres the text inside it, so the wordmark sits on the same line
            // as the icons instead of hanging from the top of the grid row.
            // The right padding cancels the trailing letter-space so the glyphs
            // read as optically centred.
            <span
              className={`flex h-11 items-center justify-center whitespace-nowrap pr-[0.24em] font-serif text-[22px] uppercase leading-none tracking-[0.24em] transition-colors duration-300 sm:h-10 sm:text-[30px] sm:pr-[0.3em] sm:tracking-[0.3em] ${
                scrolled ? "text-plum" : "text-white"
              }`}
            >
              ZUHA&apos;S
            </span>
          ) : (
            <span
              aria-hidden="true"
              className="block h-[58px] w-[111px] transition-[filter] duration-500 sm:h-[69px] sm:w-[132px]"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, #3a1833 0%, #4a2040 45%, #7a3570 72%, #b89b63 118%)",
                WebkitMaskImage:
                  "url('/images/brand/dins-by-daniyal-logo-white.png')",
                maskImage: "url('/images/brand/dins-by-daniyal-logo-white.png')",
                WebkitMaskRepeat: "no-repeat",
                maskRepeat: "no-repeat",
                WebkitMaskSize: "contain",
                maskSize: "contain",
                WebkitMaskPosition: "center",
                maskPosition: "center",
                filter: "drop-shadow(0 2px 8px rgba(74,32,64,0.18))",
              }}
            />
          )}
        </Link>

        <div className="flex items-center justify-self-end gap-0.5 sm:gap-1">
          <NavIcon
            label="Search"
            effect="search"
            tone={tone}
            delay={0.1}
            onClick={() => setPanel("search")}
            className={`hidden lg:inline-flex ${iconButtonClass}`}
            icon={
              <Search
                className="h-[18px] w-[18px]"
                strokeWidth={1.75}
                aria-hidden="true"
              />
            }
          />
          <div className="relative" data-account-button>
            <NavIcon
              label={
                accountState === "signedOut"
                  ? "Login / My Account"
                  : "My Account"
              }
              effect="account"
              tone={tone}
              delay={0.15}
              onClick={handleAccountClick}
              className={`inline-flex ${iconButtonClass}`}
              expanded={accountDropdownOpen}
              icon={
                <User
                  className="h-[18px] w-[18px]"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
              }
            />
            {accountState !== "signedOut" && accountDropdownOpen && (
              <div
                className="account-dropdown absolute right-0 top-full mt-2 z-50 min-w-[180px] overflow-hidden rounded-xl border border-charcoal/10 bg-white shadow-lg shadow-plum/10 ring-1 ring-charcoal/5"
                data-account-dropdown
                role="menu"
                aria-label="Account menu"
              >
                <Link
                  href="/account"
                  className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-charcoal hover:bg-plum/5 hover:text-plum"
                  role="menuitem"
                  onClick={() => setAccountDropdownOpen(false)}
                >
                  <User className="h-4 w-4" aria-hidden="true" />
                  My Account
                </Link>
                <Link
                  href="/orders"
                  className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-charcoal hover:bg-plum/5 hover:text-plum"
                  role="menuitem"
                  onClick={() => setAccountDropdownOpen(false)}
                >
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  >
                    <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  My Orders
                </Link>
                <Link
                  href="/cart"
                  className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-charcoal hover:bg-plum/5 hover:text-plum"
                  role="menuitem"
                  onClick={() => setAccountDropdownOpen(false)}
                >
                  <Handbag className="h-4 w-4" aria-hidden="true" />
                  My Bag
                </Link>
                <Link
                  href="/wishlist"
                  className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-charcoal hover:bg-plum/5 hover:text-plum"
                  role="menuitem"
                  onClick={() => setAccountDropdownOpen(false)}
                >
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  >
                    <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                  </svg>
                  Wishlist
                </Link>
                <hr className="my-1 border-charcoal/10" />
                <button
                  type="button"
                  onClick={signOutClient}
                  className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50"
                  role="menuitem"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
          <NavIcon
            label={`Cart${cartCount > 0 ? `, ${cartCount} items` : ""}`}
            effect="bag"
            tone={tone}
            delay={0.2}
            onClick={() => setPanel("cart")}
            className={`inline-flex ${iconButtonClass}`}
            icon={
              <Handbag
                className="h-[18px] w-[18px]"
                strokeWidth={1.75}
                aria-hidden="true"
              />
            }
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

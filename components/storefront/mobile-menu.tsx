import Link from "next/link";
import { User, LogOut, LayoutDashboard } from "lucide-react";
import { useEffect, useState } from "react";

import { categoryHref } from "@/lib/storefront/format";
import type { Category } from "@/lib/storefront/types";
import { signOutAction } from "@/app/storefront/actions";

type MobileMenuProps = {
  onNavigate: () => void;
  categories: Category[];
};

type AccountState = "signedOut" | "signedIn" | "admin";

/**
 * Navigation drawer content. Categories come from the storefront data layer
 * (future admin-controlled) and close the drawer on navigation.
 */
export function MobileMenu({ onNavigate, categories }: MobileMenuProps) {
  const [account, setAccount] = useState<AccountState | null>(null);

  useEffect(() => {
    let active = true;

    async function detectSession() {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        if (!data.user) {
          if (active) setAccount("signedOut");
          return;
        }
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", data.user.id)
          .maybeSingle();

        let role: string | null = profile?.role ?? null;

        // Fallback: if RLS returns no row, use the SECURITY DEFINER is_admin()
        // RPC — same pattern used in lib/auth/session.ts server-side.
        if (!role) {
          const { data: adminCheck } = await supabase.rpc("is_admin", {
            uid: data.user.id,
          });
          if (adminCheck === true) role = "admin";
        }

        if (active) setAccount(role === "admin" ? "admin" : "signedIn");
      } catch {
        if (active) setAccount("signedOut");
      }
    }

    detectSession();

    return () => {
      active = false;
    };
  }, []);

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

      {account === "admin" ? (
        <section
          aria-label="Admin Account"
          className="border-t border-charcoal/10 pt-6"
        >
          <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-charcoal-muted">
            <User className="h-3.5 w-3.5 text-plum" aria-hidden="true" />
            Admin
          </p>
          <nav className="mt-2 space-y-2">
            <Link
              href="/admin"
              onClick={onNavigate}
              className="flex items-center justify-between border-b border-charcoal/10 pb-3.5 font-serif text-base text-plum transition-colors hover:text-plum-dark"
            >
              <span className="flex items-center gap-2">
                <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                Admin Dashboard
              </span>
              <span aria-hidden="true" className="text-plum">→</span>
            </Link>
            <form action={signOutAction}>
              <button
                type="submit"
                className="flex w-full items-center justify-between border-b border-charcoal/10 pb-3.5 font-serif text-base text-charcoal transition-colors hover:text-red-600"
              >
                <span className="flex items-center gap-2">
                  <LogOut className="h-3.5 w-3.5 text-plum" aria-hidden="true" />
                  Sign Out
                </span>
                <span aria-hidden="true" className="text-plum">→</span>
              </button>
            </form>
          </nav>
        </section>
      ) : account === "signedIn" ? (
        <section
          aria-label="Account"
          className="border-t border-charcoal/10 pt-6"
        >
          <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-charcoal-muted">
            <User className="h-3.5 w-3.5 text-plum" aria-hidden="true" />
            Account
          </p>
          <nav className="mt-2 space-y-2">
            <Link
              href="/account"
              onClick={onNavigate}
              className="flex items-center justify-between border-b border-charcoal/10 pb-3.5 font-serif text-base text-charcoal transition-colors hover:text-plum"
            >
              My Account
              <span aria-hidden="true" className="text-plum">→</span>
            </Link>
            <Link
              href="/orders"
              onClick={onNavigate}
              className="flex items-center justify-between border-b border-charcoal/10 pb-3.5 font-serif text-base text-charcoal transition-colors hover:text-plum"
            >
              My Orders
              <span aria-hidden="true" className="text-plum">→</span>
            </Link>
            <Link
              href="/cart"
              onClick={onNavigate}
              className="flex items-center justify-between border-b border-charcoal/10 pb-3.5 font-serif text-base text-charcoal transition-colors hover:text-plum"
            >
              My Bag
              <span aria-hidden="true" className="text-plum">→</span>
            </Link>
            <Link
              href="/wishlist"
              onClick={onNavigate}
              className="flex items-center justify-between border-b border-charcoal/10 pb-3.5 font-serif text-base text-charcoal transition-colors hover:text-plum"
            >
              Wishlist
              <span aria-hidden="true" className="text-plum">→</span>
            </Link>
            <form action={signOutAction}>
              <button
                type="submit"
                className="flex w-full items-center justify-between border-b border-charcoal/10 pb-3.5 font-serif text-base text-charcoal transition-colors hover:text-red-600"
              >
                <span className="flex items-center gap-2">
                  <LogOut className="h-3.5 w-3.5 text-plum" aria-hidden="true" />
                  Sign Out
                </span>
                <span aria-hidden="true" className="text-plum">→</span>
              </button>
            </form>
          </nav>
        </section>
      ) : account === "signedOut" ? (
        <section
          aria-label="Account"
          className="border-t border-charcoal/10 pt-6"
        >
          <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-charcoal-muted">
            <User className="h-3.5 w-3.5 text-plum" aria-hidden="true" />
            Account
          </p>
          <Link
            href="/login"
            onClick={onNavigate}
            className="mt-2 flex items-center justify-between border-b border-charcoal/10 pb-3.5 font-serif text-base text-charcoal transition-colors hover:text-plum"
          >
            Login / My Account
            <span aria-hidden="true" className="text-plum">→</span>
          </Link>
        </section>
      ) : null}

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
"use client";

import Link from "next/link";
import { motion, type Variants } from "framer-motion";
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

const MotionLink = motion.create(Link);

const easing: [number, number, number, number] = [0.22, 1, 0.36, 1];

const listVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, x: -18 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.45, ease: easing } },
};

const rowClass =
  "group flex items-center justify-between gap-3 border-b border-charcoal/10 py-3.5 font-serif text-base text-charcoal transition-colors hover:text-plum";
const arrowClass =
  "text-plum transition-transform duration-300 ease-out group-hover:translate-x-1.5";

/**
 * Navigation drawer content. Categories come from the storefront data layer
 * (future admin-controlled) and close the drawer on navigation. Rows cascade in
 * with a staggered motion and lift an arrow on hover for a premium feel.
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

  const shopItems = [
    { href: "/shop", label: "Shop All" },
    { href: "/#section-new-arrivals", label: "New Arrivals" },
    ...categories.map((category) => ({
      href: categoryHref(category.slug),
      label: category.name,
    })),
  ];

  return (
    <motion.div
      variants={listVariants}
      className="flex flex-col gap-8 px-5 py-6 sm:px-6"
    >
      <motion.nav aria-label="Shop" className="flex flex-col" variants={listVariants}>
        {shopItems.map((item, index) => (
          <MotionLink
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            variants={itemVariants}
            className={rowClass}
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
          </MotionLink>
        ))}
      </motion.nav>

      {account === "admin" ? (
        <motion.section
          aria-label="Admin Account"
          className="border-t border-charcoal/10 pt-6"
          variants={listVariants}
        >
          <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-charcoal-muted">
            <User className="h-3.5 w-3.5 text-plum" aria-hidden="true" />
            Admin
          </p>
          <nav className="mt-2 flex flex-col">
            <MotionLink
              href="/admin"
              onClick={onNavigate}
              variants={itemVariants}
              className={rowClass}
            >
              <span className="flex items-center gap-2">
                <LayoutDashboard className="h-4 w-4 text-plum" aria-hidden="true" />
                Admin Dashboard
              </span>
              <span aria-hidden="true" className={arrowClass}>
                →
              </span>
            </MotionLink>
            <motion.form variants={itemVariants} action={signOutAction}>
              <button
                type="submit"
                className="group flex w-full items-center justify-between border-b border-charcoal/10 py-3.5 font-serif text-base text-charcoal transition-colors hover:text-red-600"
              >
                <span className="flex items-center gap-2">
                  <LogOut className="h-3.5 w-3.5 text-plum" aria-hidden="true" />
                  Sign Out
                </span>
                <span aria-hidden="true" className={arrowClass}>
                  →
                </span>
              </button>
            </motion.form>
          </nav>
        </motion.section>
      ) : account === "signedIn" ? (
        <motion.section
          aria-label="Account"
          className="border-t border-charcoal/10 pt-6"
          variants={listVariants}
        >
          <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-charcoal-muted">
            <User className="h-3.5 w-3.5 text-plum" aria-hidden="true" />
            Account
          </p>
          <nav className="mt-2 flex flex-col">
            {[
              { href: "/account", label: "My Account" },
              { href: "/orders", label: "My Orders" },
              { href: "/cart", label: "My Bag" },
              { href: "/wishlist", label: "Wishlist" },
            ].map((item) => (
              <MotionLink
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                variants={itemVariants}
                className={rowClass}
              >
                {item.label}
                <span aria-hidden="true" className={arrowClass}>
                  →
                </span>
              </MotionLink>
            ))}
            <motion.form variants={itemVariants} action={signOutAction}>
              <button
                type="submit"
                className="group flex w-full items-center justify-between border-b border-charcoal/10 py-3.5 font-serif text-base text-charcoal transition-colors hover:text-red-600"
              >
                <span className="flex items-center gap-2">
                  <LogOut className="h-3.5 w-3.5 text-plum" aria-hidden="true" />
                  Sign Out
                </span>
                <span aria-hidden="true" className={arrowClass}>
                  →
                </span>
              </button>
            </motion.form>
          </nav>
        </motion.section>
      ) : null}

      <motion.div
        variants={itemVariants}
        className="text-xs leading-relaxed text-charcoal-muted"
      >
        <p>Premium Pakistani fashion — crafted details, considered design.</p>
        <a
          href="mailto:care@dinsbydaniyal.com"
          className="mt-1 inline-block text-plum hover:underline"
        >
          care@dinsbydaniyal.com
        </a>
      </motion.div>
    </motion.div>
  );
}

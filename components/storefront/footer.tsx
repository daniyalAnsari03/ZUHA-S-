import Link from "next/link";

import { Container } from "@/components/ui/container";
import { FacebookIcon, InstagramIcon } from "@/components/ui/social-icons";
import { categoryHref } from "@/lib/storefront/format";
import type { Category } from "@/lib/storefront/types";

const comingSoon = ["Shipping & Returns", "Size Guide", "Order Tracking", "Privacy Policy", "Terms of Service"];

type FooterProps = {
  categories: Category[];
};

/**
 * Premium footer. Policies and customer-care pages don't exist yet, so they
 * are shown as clearly upcoming items rather than dead links.
 */
export function Footer({ categories }: FooterProps) {
  return (
    <footer className="border-t border-charcoal/10 bg-ivory">
      <Container size="lg" className="py-14 sm:py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="font-serif text-lg tracking-wide text-charcoal">
              dINS by Daniyal
            </p>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-charcoal-muted">
              A Pakistani fashion label for considered craftsmanship —
              embroidery, jamawar, lawn and unstitched collections.
            </p>
            <div className="mt-5 flex items-center gap-3">
              <span
                aria-label="Instagram (coming soon)"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-charcoal/15 text-charcoal-muted"
              >
                <InstagramIcon className="h-4 w-4" />
              </span>
              <span
                aria-label="Facebook (coming soon)"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-charcoal/15 text-charcoal-muted"
              >
                <FacebookIcon className="h-4 w-4" />
              </span>
            </div>
          </div>

          <nav aria-label="Shop">
            <h3 className="text-xs font-medium uppercase tracking-[0.2em] text-charcoal">
              Shop
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link href="/shop" className="text-charcoal-muted hover:text-plum">
                  Shop All
                </Link>
              </li>
              <li>
                <Link
                  href="/#section-new-arrivals"
                  className="text-charcoal-muted hover:text-plum"
                >
                  New Arrivals
                </Link>
              </li>
              {categories.map((category) => (
                <li key={category.id}>
                  <Link
                    href={categoryHref(category.slug)}
                    className="text-charcoal-muted hover:text-plum"
                  >
                    {category.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Customer care">
            <h3 className="text-xs font-medium uppercase tracking-[0.2em] text-charcoal">
              Customer Care
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <a
                  href="mailto:care@dinsbydaniyal.com"
                  className="text-charcoal-muted hover:text-plum"
                >
                  care@dinsbydaniyal.com
                </a>
              </li>
              {comingSoon.map((item) => (
                <li key={item} className="text-charcoal-muted/70">
                  {item} <span className="text-[10px] uppercase tracking-wider text-gold-muted">· soon</span>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h3 className="text-xs font-medium uppercase tracking-[0.2em] text-charcoal">
              About
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link href="/#brand-story" className="text-charcoal-muted hover:text-plum">
                  Our Story
                </Link>
              </li>
              <li>
                <Link href="/#newsletter" className="text-charcoal-muted hover:text-plum">
                  Newsletter
                </Link>
              </li>
              <li className="text-charcoal-muted">Karachi, Pakistan</li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-charcoal/10 pt-6 text-xs text-charcoal-muted sm:flex-row">
          <p>© {new Date().getFullYear()} dINS by Daniyal. All rights reserved.</p>
          <p>Made with care in Pakistan.</p>
        </div>
      </Container>
    </footer>
  );
}
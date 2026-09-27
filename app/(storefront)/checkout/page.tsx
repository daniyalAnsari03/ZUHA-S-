import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/ui/container";
import { CheckoutForm } from "@/components/storefront/checkout-form";
import { getAuthUser } from "@/lib/auth/session";
import { getCartSummaryIfExists } from "@/services/cart/cart-service";
import { computeTotals } from "@/services/checkout/checkout-service";

export const metadata: Metadata = {
  title: "Checkout",
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * Checkout foundation page (Phase 4). The cart isn't finalized into an order
 * here — that belongs to Phase 5 — but every detail is validated and totals
 * are always computed server-side from trusted product data.
 */
export default async function CheckoutPage() {
  const user = await getAuthUser();
  if (!user) {
    return (
      <main className="flex-1 bg-ivory">
        <Container size="md" className="py-20 text-center sm:py-28">
          <h1 className="font-serif text-2xl text-charcoal sm:text-3xl">
            Please sign in to check out
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-charcoal-muted">
            You must be signed in to continue. Sign in and your validated bag
            will be waiting.
          </p>
          <Link
            href="/shop"
            className="mt-8 inline-block border border-charcoal/20 bg-transparent px-8 py-3 text-sm font-medium tracking-wide text-charcoal transition-colors hover:border-plum hover:text-plum"
          >
            Continue shopping
          </Link>
        </Container>
      </main>
    );
  }

  const summary = await getCartSummaryIfExists(user.id);

  if (!summary || summary.items.length === 0) {
    return (
      <main className="flex-1 bg-ivory">
        <Container size="md" className="py-20 text-center sm:py-28">
          <h1 className="font-serif text-2xl text-charcoal sm:text-3xl">
            Your bag is empty
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-charcoal-muted">
            Add a few pieces before you check out.
          </p>
          <Link
            href="/shop"
            className="mt-8 inline-block border border-charcoal/20 bg-transparent px-8 py-3 text-sm font-medium tracking-wide text-charcoal transition-colors hover:border-plum hover:text-plum"
          >
            Shop the collection
          </Link>
        </Container>
      </main>
    );
  }

  const totals = computeTotals(summary);

  return (
    <main className="flex-1 bg-ivory pb-20">
      <Container size="lg" className="py-10 sm:py-14">
        <p className="text-[11px] uppercase tracking-[0.32em] text-gold-muted">
          <Link href="/" className="transition-colors hover:text-plum">
            Home
          </Link>{" "}
          / Checkout
        </p>
        <h1 className="mt-3 font-serif text-2xl text-charcoal sm:text-3xl">
          Checkout
        </h1>

        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_380px] lg:gap-14">
          <CheckoutForm
            itemCount={summary.itemCount}
            totals={totals}
            items={summary.items.map((i) => ({
              id: i.id,
              name: i.name,
              slug: i.slug,
              price: i.price,
              image: i.image,
              fabric: i.fabric,
              quantity: i.quantity,
              subtotal: i.subtotal,
            }))}
          />
        </div>
      </Container>
    </main>
  );
}

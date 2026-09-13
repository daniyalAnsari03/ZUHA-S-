import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import Image from "next/image";
import { Container } from "@/components/ui/container";
import { getAuthUser } from "@/lib/auth/session";
import { resolveImageUrl } from "@/lib/images";
import { getCartSummaryIfExists } from "@/services/cart/cart-service";
import { computeTotals } from "@/services/checkout/checkout-service";
import { formatPrice } from "@/lib/storefront/format";

export const metadata: Metadata = {
  title: "Your Bag",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function CartPage() {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  let summary;
  try {
    summary = await getCartSummaryIfExists(user.id);
  } catch {
    summary = null;
  }
  const items = summary?.items ?? [];
  const totals = summary ? computeTotals(summary) : { subtotal: 0, shipping: 0, total: 0, itemCount: 0 };

  return (
    <main className="flex-1 bg-ivory">
      <Container size="lg" className="py-10 sm:py-14">
        <p className="text-[11px] uppercase tracking-[0.32em] text-gold-muted">
          <Link href="/" className="transition-colors hover:text-plum">
            Home
          </Link>{" "}
          / Your Bag
        </p>

        <h1 className="mt-3 font-serif text-2xl text-charcoal sm:text-3xl">
          Your Bag
        </h1>

        {items.length === 0 ? (
          <div className="mt-8 rounded-xl border border-charcoal/10 bg-white p-8 sm:p-10 text-center">
            <p className="text-sm text-charcoal-muted">
              Your bag is empty. Browse the collection and add pieces you love.
            </p>
            <Link
              href="/shop"
              className="mt-6 inline-block border border-charcoal/20 bg-transparent px-8 py-3 text-sm font-medium tracking-wide text-charcoal transition-colors hover:border-plum hover:text-plum"
            >
              Shop the Collection
            </Link>
          </div>
        ) : (
          <>
            <ul className="mt-8 divide-y divide-charcoal/10">
              {items.map((item) => (
                <li key={item.id} className="py-6">
                  <div className="flex gap-4 sm:gap-6">
                    <Link
                      href={`/product/${encodeURIComponent(item.slug)}`}
                      className="block h-24 w-20 shrink-0 overflow-hidden rounded-lg border border-charcoal/10 bg-cream"
                    >
                      {resolveImageUrl(item.image) ? (
                        <Image
                          src={resolveImageUrl(item.image)!}
                          alt={item.name}
                          width={160}
                          height={200}
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </Link>

                    <div className="flex min-w-0 flex-1 flex-col justify-between">
                      <div>
                        <Link
                          href={`/product/${encodeURIComponent(item.slug)}`}
                          className="font-serif text-sm leading-snug text-charcoal transition-colors hover:text-plum"
                        >
                          {item.name}
                        </Link>
                        {item.fabric ? (
                          <p className="mt-0.5 text-[11px] uppercase tracking-wide text-charcoal-muted">
                            {item.fabric}
                          </p>
                        ) : null}
                        <p className="mt-1 text-sm font-medium text-charcoal">
                          {formatPrice(item.price)}
                        </p>
                      </div>

                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                        <div className="inline-flex items-center rounded-lg border border-charcoal/15 bg-white">
                          <form
                            action={async (formData: FormData) => {
                              "use server";
                              const { updateCartItemAction } = await import(
                                "@/app/storefront/actions"
                              );
                              const itemId = formData.get("itemId") as string;
                              const quantity = parseInt(formData.get("quantity") as string, 10);
                              await updateCartItemAction(itemId, quantity);
                            }}
                            className="flex items-center gap-1"
                          >
                            <input type="hidden" name="itemId" value={item.id} />
                            <input type="hidden" name="quantity" value={Math.max(1, item.quantity - 1)} />
                            <button
                              type="submit"
                              disabled={item.quantity <= 1}
                              className="inline-flex h-10 w-10 items-center justify-center text-charcoal transition-colors hover:text-plum disabled:opacity-40"
                              aria-label="Decrease quantity"
                            >
                              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                <line x1="5" y1="12" x2="19" y2="12" />
                              </svg>
                            </button>
                          </form>
                          <span className="w-10 text-center text-sm font-medium text-charcoal">{item.quantity}</span>
                          <form
                            action={async (formData: FormData) => {
                              "use server";
                              const { updateCartItemAction } = await import(
                                "@/app/storefront/actions"
                              );
                              const itemId = formData.get("itemId") as string;
                              const quantity = parseInt(formData.get("quantity") as string, 10);
                              await updateCartItemAction(itemId, quantity);
                            }}
                            className="flex items-center gap-1"
                          >
                            <input type="hidden" name="itemId" value={item.id} />
                            <input type="hidden" name="quantity" value={item.quantity + 1} />
                            <button
                              type="submit"
                              disabled={item.quantity >= item.stock}
                              className="inline-flex h-10 w-10 items-center justify-center text-charcoal transition-colors hover:text-plum disabled:opacity-40"
                              aria-label="Increase quantity"
                            >
                              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                              </svg>
                            </button>
                          </form>
                        </div>

                        {item.quantity >= item.stock ? (
                          <p className="text-[11px] text-red-600">Only {item.stock} available</p>
                        ) : null}

                        <form
                          action={async (formData: FormData) => {
                            "use server";
                            const { removeCartItemAction } = await import(
                              "@/app/storefront/actions"
                            );
                            const itemId = formData.get("itemId") as string;
                            await removeCartItemAction(itemId);
                          }}
                          className="ml-auto sm:ml-0"
                        >
                          <input type="hidden" name="itemId" value={item.id} />
                          <button
                            type="submit"
                            className="inline-flex h-10 w-10 items-center justify-center rounded text-charcoal-muted transition-colors hover:text-red-600"
                            aria-label={`Remove ${item.name} from bag`}
                          >
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </form>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-8 rounded-xl border border-charcoal/10 bg-white p-6 sm:p-8">
              <div className="flex items-center justify-between text-sm text-charcoal">
                <span>
                  Subtotal ({totals.itemCount} item{totals.itemCount === 1 ? "" : "s"})
                </span>
                <span className="font-medium">{formatPrice(totals.subtotal)}</span>
              </div>

              <div className="mt-3 flex items-center justify-between text-sm text-charcoal">
                <span>Shipping</span>
                <span className="font-medium">
                  {totals.shipping === 0 ? "Complimentary" : formatPrice(totals.shipping)}
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-charcoal/10 pt-3 text-base font-medium text-charcoal">
                <span>Total</span>
                <span>{formatPrice(totals.total)}</span>
              </div>

              <Link href="/checkout" className="mt-6 block">
                <button type="button" className="w-full rounded-lg bg-plum px-6 py-3 text-sm font-medium uppercase tracking-[0.14em] text-white transition-colors hover:bg-plum-dark">
                  PROCEED TO CHECKOUT
                </button>
              </Link>

              <form
                action={async () => {
                  "use server";
                  const { clearCartAction } = await import("@/app/storefront/actions");
                  await clearCartAction();
                }}
                className="mt-4"
              >
                <button
                  type="submit"
                  className="w-full text-center text-xs uppercase tracking-[0.2em] text-charcoal-muted transition-colors hover:text-red-600"
                >
                  Clear bag
                </button>
              </form>
            </div>
          </>
        )}
      </Container>
    </main>
  );
}
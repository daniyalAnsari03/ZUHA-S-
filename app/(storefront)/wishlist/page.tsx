import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Container } from "@/components/ui/container";
import { getAuthUser } from "@/lib/auth/session";
import { resolveImageUrl } from "@/lib/images";
import { getWishlistSummaryIfExists } from "@/services/wishlist/wishlist-service";
import { formatPrice } from "@/lib/storefront/format";

export const metadata: Metadata = {
  title: "Wishlist",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function WishlistPage() {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  const wishlist = await getWishlistSummaryIfExists(user.id);
  const items = wishlist?.items ?? [];

  return (
    <main className="flex-1 bg-ivory">
      <Container size="lg" className="py-10 sm:py-14">
        <p className="text-[11px] uppercase tracking-[0.32em] text-gold-muted">
          <Link href="/" className="transition-colors hover:text-plum">
            Home
          </Link>{" "}
          / Wishlist
        </p>

        <h1 className="mt-3 font-serif text-2xl text-charcoal sm:text-3xl">
          Wishlist
        </h1>

        {items.length === 0 ? (
          <div className="mt-8 rounded-xl border border-charcoal/10 bg-white p-8 sm:p-10 text-center">
            <p className="text-sm text-charcoal-muted">
              Your wishlist is empty. Piece together the looks you love and they
              will appear here.
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
                          sizes="80px"
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
                        {item.stock <= 0 ? (
                          <p className="mt-1 text-[11px] text-red-600">
                            Out of stock
                          </p>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-3">
                        <Link
                          href="/checkout"
                          className="flex-1 rounded-lg border border-charcoal/15 bg-transparent px-4 py-2 text-sm font-medium text-charcoal transition-colors hover:border-plum hover:text-plum"
                        >
                          Move to Bag
                        </Link>
                        <form
                          action={async (formData: FormData) => {
                            "use server";
                            const { removeWishlistItemAction } =
                              await import("@/app/storefront/actions");
                            const itemId = formData.get("itemId") as string;
                            await removeWishlistItemAction(itemId);
                          }}
                        >
                          <input type="hidden" name="itemId" value={item.id} />
                          <button
                            type="submit"
                            className="inline-flex h-11 w-11 items-center justify-center rounded text-charcoal-muted transition-colors hover:text-red-600"
                            aria-label={`Remove ${item.name} from wishlist`}
                          >
                            <svg
                              className="h-4 w-4"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              aria-hidden="true"
                            >
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
          </>
        )}
      </Container>
    </main>
  );
}

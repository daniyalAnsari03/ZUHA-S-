"use client";

import Link from "next/link";
import Image from "next/image";
import { Heart, ShoppingBag, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { resolveImageUrl } from "@/lib/images";
import { formatPrice } from "@/lib/storefront/format";
import {
  getWishlistDetailsAction,
  type WishlistDetailsPayload,
} from "@/app/storefront/actions";
import { useStorefront } from "./storefront-provider";

/**
 * Functional wishlist panel shown in the navbar slide-over. Users can open a
 * product, move it to their bag or remove it. State always reconciles with the
 * server after each action.
 */
export function WishlistPanel() {
  const { addToCart, removeCartItem } = useStorefront();

  const [state, setState] = useState<{
    status: "loading" | "ready" | "error";
    payload: WishlistDetailsPayload | null;
    error?: string;
  }>({ status: "loading", payload: null });

  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await getWishlistDetailsAction();
    if (!result.ok) {
      setState({ status: "error", payload: null, error: result.error });
      return;
    }
    setState({ status: "ready", payload: result.payload });
  }, []);

  useEffect(() => {
    let active = true;
    async function fetchDetails() {
      const result = await getWishlistDetailsAction();
      if (!active) return;
      if (!result.ok) {
        setState({ status: "error", payload: null, error: result.error });
        return;
      }
      setState({ status: "ready", payload: result.payload });
    }
    void fetchDetails();
    return () => {
      active = false;
    };
  }, []);

  const moveToBag = async (itemId: string, productId: string) => {
    if (busy) return;
    setBusy(itemId);
    setActionError(null);

    const error = await addToCart(productId, 1);
    if (error) {
      setActionError(error);
    } else {
      // Once in the bag, remove from wishlist.
      await removeCartItem(itemId);
    }

    await load();
    setBusy(null);
  };

  const remove = async (itemId: string) => {
    if (busy) return;
    setBusy(itemId);
    setActionError(null);
    await removeItem(itemId);
    await load();
    setBusy(null);
  };

  const removeItem = async (itemId: string) => {
    const { removeWishlistItemAction } = await import("@/app/storefront/actions");
    const result = await removeWishlistItemAction(itemId);
    if (!result.ok) setActionError(result.error);
  };

  if (state.status === "loading") {
    return (
      <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-plum/5 text-plum">
          <Heart className="h-6 w-6 animate-pulse" aria-hidden="true" />
        </span>
        <p className="text-sm text-charcoal-muted">Loading your wishlist…</p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <EmptyState
        heading="Unable to load your wishlist"
        body={state.error ?? "Something went wrong. Please try again."}
      />
    );
  }

  const payload = state.payload;
  if (!payload || payload.items.length === 0) {
    return (
      <EmptyState
        heading="Your wishlist is empty"
        body="Piece together the looks you love and they will appear here."
        cta={{ href: "/shop", label: "Shop the Collection" }}
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <ul className="flex flex-col gap-4 px-5 py-5 sm:px-6">
        {payload.items.map((item) => (
          <li key={item.id} className="flex gap-4">
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

            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-start justify-between gap-2">
                <Link
                  href={`/product/${encodeURIComponent(item.slug)}`}
                  className="font-serif text-sm leading-snug text-charcoal transition-colors hover:text-plum"
                >
                  {item.name}
                </Link>
                <button
                  type="button"
                  onClick={() => remove(item.id)}
                  disabled={busy === item.id}
                  aria-label={`Remove ${item.name} from wishlist`}
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-charcoal-muted transition-colors hover:text-red-600 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              {item.fabric ? (
                <p className="mt-0.5 text-[11px] uppercase tracking-wide text-charcoal-muted">
                  {item.fabric}
                </p>
              ) : null}

              <p className="mt-1 text-sm font-medium text-charcoal">
                {formatPrice(item.price)}
              </p>

              {item.stock <= 0 ? (
                <p className="mt-1 text-[11px] text-red-600">Out of stock</p>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2 self-start"
                  onClick={() => moveToBag(item.id, item.productId)}
                  disabled={busy === item.id}
                >
                  <ShoppingBag className="h-3.5 w-3.5" aria-hidden="true" />
                  Move to Bag
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {actionError ? (
        <p role="alert" className="px-5 pb-2 text-sm text-red-600 sm:px-6">
          {actionError}
        </p>
      ) : null}
    </div>
  );
}

function EmptyState({
  heading,
  body,
  cta,
}: {
  heading: string;
  body: string;
  cta?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col items-center gap-4 px-5 py-12 text-center sm:px-6">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-plum/5 text-plum">
        <Heart className="h-6 w-6" aria-hidden="true" />
      </span>
      <h3 className="font-serif text-xl text-charcoal">{heading}</h3>
      <p className="max-w-xs text-sm leading-relaxed text-charcoal-muted">{body}</p>
      {cta ? (
        <Link href={cta.href} className="mt-2">
          <Button variant="primary">{cta.label}</Button>
        </Link>
      ) : null}
    </div>
  );
}
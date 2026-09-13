"use client";

import Link from "next/link";
import Image from "next/image";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { resolveImageUrl } from "@/lib/images";
import { formatPrice } from "@/lib/storefront/format";
import {
  getCartDetailsAction,
  type CartDetailsPayload,
} from "@/app/storefront/actions";
import { useStorefront } from "./storefront-provider";

/**
 * Functional bag panel shown in the navbar slide-over. Prices and stock always
 * come from the live cart summary (server-revalidated); the client never
 * invents totals.
 */
export function CartPanel() {
  const { updateCartItem, removeCartItem, clearCart } = useStorefront();

  const [state, setState] = useState<{
    status: "loading" | "ready" | "error";
    payload: CartDetailsPayload | null;
    error?: string;
  }>({ status: "loading", payload: null });

  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await getCartDetailsAction();
    if (!result.ok) {
      setState({ status: "error", payload: null, error: result.error });
      return;
    }
    setState({ status: "ready", payload: result.payload });
  }, []);

  useEffect(() => {
    let active = true;
    async function fetchDetails() {
      const result = await getCartDetailsAction();
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

  const setQuantity = async (itemId: string, quantity: number) => {
    if (busyItem) return;
    setBusyItem(itemId);
    setActionError(null);
    const error = await updateCartItem(itemId, quantity);
    if (error) setActionError(error);
    await load();
    setBusyItem(null);
  };

  const remove = async (itemId: string) => {
    if (busyItem) return;
    setBusyItem(itemId);
    setActionError(null);
    const error = await removeCartItem(itemId);
    if (error) setActionError(error);
    await load();
    setBusyItem(null);
  };

  const clear = async () => {
    if (busyItem) return;
    setBusyItem("clear");
    setActionError(null);
    const error = await clearCart();
    if (error) setActionError(error);
    await load();
    setBusyItem(null);
  };

  if (state.status === "loading") {
    return (
      <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-plum/5 text-plum">
          <ShoppingBag className="h-6 w-6 animate-pulse" aria-hidden="true" />
        </span>
        <p className="text-sm text-charcoal-muted">Loading your bag…</p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <EmptyState
        heading="Unable to load your bag"
        body={state.error ?? "Something went wrong. Please try again."}
      />
    );
  }

  const payload = state.payload;
  if (!payload || payload.items.length === 0) {
    return (
      <EmptyState
        heading="Your bag is empty"
        body="Browse the collection and add pieces you love."
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
                  disabled={busyItem === item.id}
                  aria-label={`Remove ${item.name} from bag`}
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

              <div className="mt-2 inline-flex self-start items-center rounded-lg border border-charcoal/15 bg-white">
                <button
                  type="button"
                  onClick={() => setQuantity(item.id, item.quantity - 1)}
                  disabled={item.quantity <= 1 || busyItem === item.id}
                  aria-label="Decrease quantity"
                  className="inline-flex h-8 w-8 items-center justify-center text-charcoal transition-colors hover:text-plum disabled:opacity-40"
                >
                  <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <span aria-live="polite" className="w-8 text-center text-sm text-charcoal">
                  {item.quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity(item.id, item.quantity + 1)}
                  disabled={item.quantity >= item.stock || busyItem === item.id}
                  aria-label="Increase quantity"
                  className="inline-flex h-8 w-8 items-center justify-center text-charcoal transition-colors hover:text-plum disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
              {item.quantity >= item.stock ? (
                <p className="mt-1 text-[11px] text-red-600">
                  Only {item.stock} available
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-auto border-t border-charcoal/10 px-5 py-5 sm:px-6">
        {actionError ? (
          <p role="alert" className="mb-3 text-sm text-red-600">
            {actionError}
          </p>
        ) : null}

        <div className="flex items-center justify-between text-sm text-charcoal">
          <span>
            Subtotal ({payload.itemCount} item{payload.itemCount === 1 ? "" : "s"})
          </span>
          <span className="font-medium">{formatPrice(payload.subtotal)}</span>
        </div>

        <Link href="/checkout" className="mt-4 block">
          <Button variant="primary" size="lg" className="w-full">
            CHECKOUT
          </Button>
        </Link>

        <button
          type="button"
          onClick={clear}
          disabled={busyItem === "clear"}
          className="mt-3 w-full text-center text-xs uppercase tracking-[0.2em] text-charcoal-muted transition-colors hover:text-red-600 disabled:opacity-50"
        >
          Clear bag
        </button>
      </div>
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
        <ShoppingBag className="h-6 w-6" aria-hidden="true" />
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
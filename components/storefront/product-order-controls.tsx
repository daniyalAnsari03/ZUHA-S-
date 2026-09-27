"use client";

import { Minus, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useStorefront } from "./storefront-provider";

type ProductOrderControlsProps = {
  productId: string;
  stock: number;
  disabled?: boolean;
  className?: string;
};

/**
 * Premium order controls for the product detail page: a quantity stepper
 * (bounded by available stock), Add to Bag and Buy Now. All writes go through
 * the server action / service layer — stock is re-checked server-side.
 */
export function ProductOrderControls({
  productId,
  stock,
  disabled = false,
  className,
}: ProductOrderControlsProps) {
  const router = useRouter();
  const { addToCart } = useStorefront();

  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState<"add" | "buy" | null>(null);
  const [message, setMessage] = useState<{
    text: string;
    tone: "ok" | "error";
  } | null>(null);
  const [timing, setTiming] = useState<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(
    () => () => {
      if (timing) clearTimeout(timing);
    },
    [timing],
  );

  const unavailable = disabled || stock <= 0;

  const flash = (text: string, tone: "ok" | "error") => {
    setMessage({ text, tone });
    if (timing) clearTimeout(timing);
    setTiming(
      setTimeout(() => {
        setMessage(null);
      }, 3000),
    );
  };

  const run = async (action: "add" | "buy") => {
    if (unavailable || busy) return;

    if (action === "buy") {
      setBusy("buy");
      const error = await addToCart(productId, quantity);
      if (error) {
        setBusy(null);
        flash(error, "error");
        return;
      }
      setBusy(null);
      router.push("/checkout");
      return;
    }

    setBusy("add");
    const error = await addToCart(productId, quantity);
    setBusy(null);
    if (error) {
      flash(error, "error");
      return;
    }
    flash("Added to your bag", "ok");
  };

  const inc = () => setQuantity((q) => Math.min(q + 1, stock));
  const dec = () => setQuantity((q) => Math.max(q - 1, 1));

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center gap-4">
        <span className="text-[11px] uppercase tracking-[0.2em] text-charcoal-muted">
          Quantity
        </span>
        <div className="inline-flex items-center rounded-lg border border-charcoal/15 bg-white">
          <button
            type="button"
            onClick={dec}
            disabled={quantity <= 1 || unavailable}
            aria-label="Decrease quantity"
            className="inline-flex h-11 w-11 items-center justify-center text-charcoal transition-colors hover:text-plum disabled:opacity-40"
          >
            <Minus className="h-4 w-4" aria-hidden="true" />
          </button>
          <span
            aria-live="polite"
            className="w-10 text-center text-sm font-medium text-charcoal"
          >
            {quantity}
          </span>
          <button
            type="button"
            onClick={inc}
            disabled={quantity >= stock || unavailable}
            aria-label="Increase quantity"
            className="inline-flex h-11 w-11 items-center justify-center text-charcoal transition-colors hover:text-plum disabled:opacity-40"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/*
        The two actions stack on mobile and sit side by side from `sm` up. The
        `flex-1` is deliberately `sm:`-scoped: inside this column flex container
        `flex-1` sets `flex-basis: 0%` on the *vertical* main axis, which beat
        the button's own `h-12` and collapsed both actions to their bare text
        height (24px) on phones — well under the 44px minimum tap target.
      */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          type="button"
          variant="primary"
          size="lg"
          className="sm:flex-1"
          onClick={() => run("add")}
          disabled={unavailable || busy !== null}
        >
          {busy === "add"
            ? "Adding…"
            : unavailable
              ? "Out of Stock"
              : "ADD TO BAG"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="sm:flex-1"
          onClick={() => run("buy")}
          disabled={unavailable || busy !== null}
        >
          {busy === "buy" ? "Preparing…" : "BUY NOW"}
        </Button>
      </div>

      <div aria-live="polite" className="min-h-5">
        {message ? (
          <p
            className={cn(
              "text-sm",
              message.tone === "error" ? "text-red-600" : "text-green-700",
            )}
          >
            {message.text}
          </p>
        ) : null}
      </div>
    </div>
  );
}

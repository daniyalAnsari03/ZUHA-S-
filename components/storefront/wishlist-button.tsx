"use client";

import { Heart } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { useStorefront } from "./storefront-provider";

type WishlistButtonProps = {
  productId: string;
  initialSaved?: boolean;
  className?: string;
};

/**
 * Wishlist toggle. Reflects persistent DB state (via the storefront provider)
 * and gives clear feedback; guests are told to sign in.
 */
export function WishlistButton({
  productId,
  initialSaved = false,
  className,
}: WishlistButtonProps) {
  const { toggleWishlist } = useStorefront();
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const handleToggle = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);

    const result = await toggleWishlist(productId);
    setBusy(false);

    if (result.error) {
      setError(result.error);
      timer.current = setTimeout(() => setError(null), 3200);
      return;
    }

    setSaved(result.saved);
  };

  return (
    <div className={cn("flex flex-col items-end gap-1", className)}>
      <button
        type="button"
        onClick={handleToggle}
        disabled={busy}
        aria-pressed={saved}
        aria-label={saved ? "Remove from wishlist" : "Add to wishlist"}
        className={cn(
          "inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors",
          "focus-visible:outline-plum disabled:opacity-60",
          saved
            ? "bg-plum text-white hover:bg-plum-dark"
            : "bg-white/90 text-charcoal hover:bg-plum/10 hover:text-plum",
        )}
      >
        <Heart
          className={cn("h-[18px] w-[18px]", saved && "fill-current")}
          aria-hidden="true"
        />
      </button>
      {error ? (
        <p aria-live="polite" className="rounded bg-white/90 px-2 py-1 text-[11px] text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
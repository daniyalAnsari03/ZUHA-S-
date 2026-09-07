import { Heart, ShoppingBag } from "lucide-react";

type UtilityPanelProps = {
  variant: "wishlist" | "cart";
};

const copy = {
  wishlist: {
    heading: "Your wishlist is empty",
    body: "Save pieces you love and discover them here. Wishlist arrives in a later phase and will persist for signed-in customers.",
  },
  cart: {
    heading: "Your bag is empty",
    body: "Cart and checkout arrive in a later phase. For now, enjoy browsing the collection.",
  },
} as const;

/**
 * Honest placeholder states for the wishlist and cart entry points. No fake
 * persistence is claimed — the UI clearly marks these as upcoming features.
 */
export function UtilityPanel({ variant }: UtilityPanelProps) {
  const Icon = variant === "wishlist" ? Heart : ShoppingBag;
  const text = copy[variant];

  return (
    <div className="flex flex-col items-center gap-4 px-5 py-12 text-center sm:px-6">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-plum/5 text-plum">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <h3 className="font-serif text-xl text-charcoal">{text.heading}</h3>
      <p className="max-w-xs text-sm leading-relaxed text-charcoal-muted">
        {text.body}
      </p>
    </div>
  );
}
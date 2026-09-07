"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";

import { getAuthUser } from "@/lib/auth/session";
import { ServiceError } from "@/services/base";
import {
  addToCart,
  clearCart,
  getCartSummary,
  getCartSummaryIfExists,
  removeCartItem,
  updateCartItem,
  type CartSummary,
} from "@/services/cart/cart-service";
import {
  addToWishlist,
  getWishlistSummary,
  getWishlistSummaryIfExists,
  removeWishlistItem,
  toggleWishlist,
  type WishlistSummary,
} from "@/services/wishlist/wishlist-service";

export type CartActionResult =
  | { ok: true; itemCount: number; subtotal: number }
  | { ok: false; error: string };

export type WishlistActionResult =
  | { ok: true; saved: boolean; itemCount: number; productIds: string[] }
  | { ok: false; error: string };

export type StorefrontInitialState = {
  cartCount: number;
  wishlistCount: number;
};

export type CartDetailsPayload = {
  cartId: string;
  itemCount: number;
  subtotal: number;
  items: CartSummary["items"];
};

export type WishlistDetailsPayload = {
  wishlistId: string;
  itemCount: number;
  productIds: string[];
  items: WishlistSummary["items"];
};

export type CheckoutActionResult =
  | {
      ok: true;
      itemCount: number;
      subtotal: number;
      shipping: number;
      total: number;
      message: string;
    }
  | { ok: false; error: string };

function errorText(error: unknown): string {
  if (error instanceof ServiceError) return error.message;
  if (error instanceof ZodError) {
    return error.issues.map((issue) => issue.message).join(" ");
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}

/* ---------------------------------------------------------------------------
 * Initial state (navbar badges) — read-only, never creates rows
 * --------------------------------------------------------------------- */

export async function getStorefrontInitialStateAction(): Promise<StorefrontInitialState> {
  const user = await getAuthUser();
  if (!user) {
    return { cartCount: 0, wishlistCount: 0 };
  }

  const [cart, wishlist] = await Promise.all([
    getCartSummaryIfExists(user.id),
    getWishlistSummaryIfExists(user.id),
  ]);

  return {
    cartCount: cart?.itemCount ?? 0,
    wishlistCount: wishlist?.itemCount ?? 0,
  };
}

export async function getCartDetailsAction(): Promise<
  | { ok: true; payload: CartDetailsPayload }
  | { ok: false; error: string }
> {
  const user = await getAuthUser();
  if (!user) {
    return { ok: false, error: "Please sign in to view your bag." };
  }

  try {
    const summary = await getCartSummaryIfExists(user.id);
    if (!summary) {
      return { ok: true, payload: { cartId: "", itemCount: 0, subtotal: 0, items: [] } };
    }
    return {
      ok: true,
      payload: {
        cartId: summary.cartId,
        itemCount: summary.itemCount,
        subtotal: summary.subtotal,
        items: summary.items,
      },
    };
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
}

export async function getWishlistDetailsAction(): Promise<
  | { ok: true; payload: WishlistDetailsPayload }
  | { ok: false; error: string }
> {
  const user = await getAuthUser();
  if (!user) {
    return { ok: false, error: "Please sign in to view your wishlist." };
  }

  try {
    const summary = await getWishlistSummaryIfExists(user.id);
    if (!summary) {
      return {
        ok: true,
        payload: { wishlistId: "", itemCount: 0, productIds: [], items: [] },
      };
    }
    return {
      ok: true,
      payload: {
        wishlistId: summary.wishlistId,
        itemCount: summary.itemCount,
        productIds: summary.productIds,
        items: summary.items,
      },
    };
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
}

/* ---------------------------------------------------------------------------
 * Cart
 * --------------------------------------------------------------------- */

export async function addToCartAction(
  productId: string,
  quantity: number,
  revalidate?: string[],
): Promise<CartActionResult> {
  const user = await getAuthUser();
  if (!user) {
    return { ok: false, error: "Please sign in to add items to your bag." };
  }

  try {
    const summary = await addToCart(user.id, { productId, quantity });
    revalidatePaths(revalidate);
    return { ok: true, itemCount: summary.itemCount, subtotal: summary.subtotal };
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
}

export async function updateCartItemAction(
  itemId: string,
  quantity: number,
): Promise<CartActionResult> {
  const user = await getAuthUser();
  if (!user) {
    return { ok: false, error: "Please sign in to update your bag." };
  }

  try {
    const summary = await updateCartItem(user.id, { itemId, quantity });
    revalidatePaths(["/cart", "/checkout"]);
    return { ok: true, itemCount: summary.itemCount, subtotal: summary.subtotal };
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
}

export async function removeCartItemAction(itemId: string): Promise<CartActionResult> {
  const user = await getAuthUser();
  if (!user) {
    return { ok: false, error: "Please sign in to update your bag." };
  }

  try {
    const summary = await removeCartItem(user.id, { itemId });
    revalidatePaths(["/cart", "/checkout"]);
    return { ok: true, itemCount: summary.itemCount, subtotal: summary.subtotal };
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
}

export async function clearCartAction(): Promise<CartActionResult> {
  const user = await getAuthUser();
  if (!user) {
    return { ok: false, error: "Please sign in to clear your bag." };
  }

  try {
    const summary = await clearCart(user.id);
    revalidatePaths(["/cart", "/checkout"]);
    return { ok: true, itemCount: summary.itemCount, subtotal: summary.subtotal };
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
}

export async function getCartSummaryAction(): Promise<CartActionResult> {
  const user = await getAuthUser();
  if (!user) {
    return { ok: false, error: "Please sign in." };
  }

  try {
    const summary = await getCartSummary(user.id);
    return { ok: true, itemCount: summary.itemCount, subtotal: summary.subtotal };
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
}

/* ---------------------------------------------------------------------------
 * Wishlist
 * --------------------------------------------------------------------- */

export async function toggleWishlistAction(productId: string): Promise<WishlistActionResult> {
  const user = await getAuthUser();
  if (!user) {
    return { ok: false, error: "Please sign in to use your wishlist." };
  }

  try {
    const { saved, summary } = await toggleWishlist(user.id, { productId });
    revalidatePaths(["/wishlist"]);
    return {
      ok: true,
      saved,
      itemCount: summary.itemCount,
      productIds: summary.productIds,
    };
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
}

export async function addToWishlistAction(productId: string): Promise<WishlistActionResult> {
  const user = await getAuthUser();
  if (!user) {
    return { ok: false, error: "Please sign in to use your wishlist." };
  }

  try {
    const summary = await addToWishlist(user.id, { productId });
    revalidatePaths(["/wishlist"]);
    return {
      ok: true,
      saved: true,
      itemCount: summary.itemCount,
      productIds: summary.productIds,
    };
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
}

export async function removeWishlistItemAction(itemId: string): Promise<WishlistActionResult> {
  const user = await getAuthUser();
  if (!user) {
    return { ok: false, error: "Please sign in to use your wishlist." };
  }

  try {
    const summary = await removeWishlistItem(user.id, { itemId });
    revalidatePaths(["/wishlist"]);
    return {
      ok: true,
      saved: false,
      itemCount: summary.itemCount,
      productIds: summary.productIds,
    };
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
}

export async function getWishlistSummaryAction(): Promise<WishlistActionResult> {
  const user = await getAuthUser();
  if (!user) {
    return { ok: false, error: "Please sign in." };
  }

  try {
    const summary = await getWishlistSummary(user.id);
    return {
      ok: true,
      saved: false,
      itemCount: summary.itemCount,
      productIds: summary.productIds,
    };
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
}

/* ---------------------------------------------------------------------------
 * Checkout
 * --------------------------------------------------------------------- */

export async function validateCheckoutAction(
  customer: {
    name: string;
    phone: string;
    email: string;
    shippingAddress: string;
    city: string;
    postalCode?: string;
    orderNotes?: string;
  },
): Promise<CheckoutActionResult> {
  const user = await getAuthUser();
  if (!user) {
    return { ok: false, error: "Please sign in to continue to checkout." };
  }

  try {
    const { validateCheckout, computeTotals } = await import(
      "@/services/checkout/checkout-service"
    );
    const result = await validateCheckout(user.id, customer);
    if (!result.ok) {
      return { ok: false, error: result.errors.join(" ") };
    }
    const totals = computeTotals(result.summary);
    return {
      ok: true,
      itemCount: totals.itemCount,
      subtotal: totals.subtotal,
      shipping: totals.shipping,
      total: totals.total,
      message: `Verified ${totals.itemCount} item(s) totaling ${totals.total} PKR.`,
    };
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
}

export type CheckoutHandoffResult =
  | {
      ok: true;
      state: "pending" | "unavailable" | "success";
      provider?: string;
      reference?: string;
      message: string;
      totals: { itemCount: number; subtotal: number; shipping: number; total: number };
    }
  | { ok: false; errors: string[] };

export async function initiateCheckoutAction(
  customer: {
    name: string;
    phone: string;
    email: string;
    shippingAddress: string;
    city: string;
    postalCode?: string;
    orderNotes?: string;
  },
): Promise<CheckoutHandoffResult> {
  const user = await getAuthUser();
  if (!user) {
    return { ok: false, errors: ["Please sign in to continue to checkout."] };
  }

  try {
    const { initiateCheckout, validateCheckout } = await import(
      "@/services/checkout/checkout-service"
    );
    const result = await validateCheckout(user.id, customer);
    if (!result.ok) {
      return { ok: false, errors: result.errors };
    }

    const handoff = await initiateCheckout(user.id, result.customer);
    if (handoff.state === "rejected") {
      return { ok: false, errors: handoff.errors };
    }

    if (handoff.state === "unavailable") {
      return {
        ok: true,
        state: "unavailable",
        message: handoff.message,
        totals: {
          itemCount: result.totals.itemCount,
          subtotal: result.totals.subtotal,
          shipping: result.totals.shipping,
          total: result.totals.total,
        },
      };
    }

    return {
      ok: true,
      state: handoff.state,
      provider: handoff.provider,
      reference: handoff.reference,
      message: handoff.message,
      totals: {
        itemCount: result.totals.itemCount,
        subtotal: result.totals.subtotal,
        shipping: result.totals.shipping,
        total: result.totals.total,
      },
    };
  } catch (error) {
    return { ok: false, errors: [errorText(error)] };
  }
}

function revalidatePaths(paths: string[] = []): void {
  for (const path of paths) {
    revalidatePath(path);
  }
}

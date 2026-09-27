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
  /**
   * Whether the visitor has an authenticated session. The storefront is a
   * static, cacheable shell, so the client cannot know this from the HTML —
   * components that behave differently for guests (for example the wishlist
   * toggle, which must send guests to sign in rather than silently failing)
   * read it from here instead of assuming.
   */
  signedIn: boolean;
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
  if (error instanceof ServiceError) {
    const base = error.message;
    if (process.env.NODE_ENV === "development" && error.cause) {
      const cause = error.cause as {
        message?: string;
        code?: string;
        details?: string;
        hint?: string;
      };
      const details = [cause.message, cause.code, cause.details, cause.hint]
        .filter(Boolean)
        .join(" | ");
      return details ? `${base} (${details})` : base;
    }
    return base;
  }
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
    return { cartCount: 0, wishlistCount: 0, signedIn: false };
  }

  const [cart, wishlist] = await Promise.all([
    getCartSummaryIfExists(user.id).catch(() => null),
    getWishlistSummaryIfExists(user.id).catch(() => null),
  ]);

  return {
    cartCount: cart?.itemCount ?? 0,
    wishlistCount: wishlist?.itemCount ?? 0,
    signedIn: true,
  };
}

export async function getCartDetailsAction(): Promise<
  { ok: true; payload: CartDetailsPayload } | { ok: false; error: string }
> {
  const user = await getAuthUser();
  if (!user) {
    return { ok: false, error: "Please sign in to view your bag." };
  }

  try {
    const summary = await getCartSummaryIfExists(user.id);
    if (!summary) {
      return {
        ok: true,
        payload: { cartId: "", itemCount: 0, subtotal: 0, items: [] },
      };
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
  { ok: true; payload: WishlistDetailsPayload } | { ok: false; error: string }
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
    revalidatePaths(["/cart", "/checkout", ...(revalidate ?? [])]);
    return {
      ok: true,
      itemCount: summary.itemCount,
      subtotal: summary.subtotal,
    };
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
    return {
      ok: true,
      itemCount: summary.itemCount,
      subtotal: summary.subtotal,
    };
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
}

export async function removeCartItemAction(
  itemId: string,
): Promise<CartActionResult> {
  const user = await getAuthUser();
  if (!user) {
    return { ok: false, error: "Please sign in to update your bag." };
  }

  try {
    const summary = await removeCartItem(user.id, { itemId });
    revalidatePaths(["/cart", "/checkout"]);
    return {
      ok: true,
      itemCount: summary.itemCount,
      subtotal: summary.subtotal,
    };
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
    return {
      ok: true,
      itemCount: summary.itemCount,
      subtotal: summary.subtotal,
    };
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
    return {
      ok: true,
      itemCount: summary.itemCount,
      subtotal: summary.subtotal,
    };
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
}

/* ---------------------------------------------------------------------------
 * Wishlist
 * --------------------------------------------------------------------- */

export async function toggleWishlistAction(
  productId: string,
): Promise<WishlistActionResult> {
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

export async function addToWishlistAction(
  productId: string,
): Promise<WishlistActionResult> {
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

export async function removeWishlistItemAction(
  itemId: string,
): Promise<WishlistActionResult> {
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

export async function validateCheckoutAction(customer: {
  name: string;
  phone: string;
  email: string;
  shippingAddress: string;
  city: string;
  postalCode?: string;
  orderNotes?: string;
}): Promise<CheckoutActionResult> {
  const user = await getAuthUser();
  if (!user) {
    return { ok: false, error: "Please sign in to continue to checkout." };
  }

  try {
    const { validateCheckout, computeTotals } =
      await import("@/services/checkout/checkout-service");
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
      totals: {
        itemCount: number;
        subtotal: number;
        shipping: number;
        total: number;
      };
    }
  | { ok: false; errors: string[] };

export async function initiateCheckoutAction(customer: {
  name: string;
  phone: string;
  email: string;
  shippingAddress: string;
  city: string;
  postalCode?: string;
  orderNotes?: string;
}): Promise<CheckoutHandoffResult> {
  const user = await getAuthUser();
  if (!user) {
    return { ok: false, errors: ["Please sign in to continue to checkout."] };
  }

  try {
    const { initiateCheckout, validateCheckout } =
      await import("@/services/checkout/checkout-service");
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

/* ---------------------------------------------------------------------------
 * Orders (customer)
 * --------------------------------------------------------------------- */

export type OrderListResult =
  | {
      ok: true;
      orders: Awaited<
        ReturnType<
          typeof import("@/services/orders/order-service").listCustomerOrders
        >
      >;
    }
  | { ok: false; error: string };

export async function getCustomerOrdersAction(): Promise<OrderListResult> {
  const user = await getAuthUser();
  if (!user) return { ok: false, error: "Please sign in to view your orders." };

  try {
    const { listCustomerOrders } =
      await import("@/services/orders/order-service");
    const orders = await listCustomerOrders(user.id);
    return { ok: true, orders };
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
}

export type OrderDetailResult =
  | {
      ok: true;
      order: Awaited<
        ReturnType<
          typeof import("@/services/orders/order-service").getOrderDetail
        >
      >;
    }
  | { ok: false; error: string };

export async function getOrderDetailAction(
  orderId: string,
): Promise<OrderDetailResult> {
  const user = await getAuthUser();
  if (!user) return { ok: false, error: "Please sign in to view this order." };

  try {
    const { getOrderDetail } = await import("@/services/orders/order-service");
    const order = await getOrderDetail(user.id, orderId);
    return { ok: true, order };
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
}

/* ---------------------------------------------------------------------------
 * Profile
 * --------------------------------------------------------------------- */

export type ProfileActionResult =
  { ok: true; message: string } | { ok: false; error: string };

export async function updateProfileAction(input: {
  full_name?: string;
  phone?: string;
  address?: string;
  city?: string;
  postal_code?: string;
}): Promise<ProfileActionResult> {
  const user = await getAuthUser();
  if (!user) return { ok: false, error: "Please sign in." };

  try {
    const { updateOwnProfile } =
      await import("@/services/profiles/update-profile");
    await updateOwnProfile(user.id, input);
    revalidatePath("/account");
    return { ok: true, message: "Profile updated." };
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
}

export async function getOwnProfileAction() {
  const user = await getAuthUser();
  if (!user) return null;

  try {
    const { getOwnProfile } =
      await import("@/services/profiles/get-own-profile");
    return await getOwnProfile(user.id);
  } catch {
    return null;
  }
}

/* ---------------------------------------------------------------------------
 * Notifications
 * --------------------------------------------------------------------- */

export type NotificationListResult =
  | {
      ok: true;
      notifications: Awaited<
        ReturnType<
          typeof import("@/services/notifications/notification-service").listNotifications
        >
      >;
      unreadCount: number;
    }
  | { ok: false; error: string };

export async function getNotificationsAction(options?: {
  unreadOnly?: boolean;
  limit?: number;
}): Promise<NotificationListResult> {
  const user = await getAuthUser();
  if (!user) return { ok: false, error: "Please sign in." };

  try {
    const ns = await import("@/services/notifications/notification-service");
    const [notifications, unreadCount] = await Promise.all([
      ns.listNotifications(user.id, options),
      ns.getUnreadCount(user.id),
    ]);
    return { ok: true, notifications, unreadCount };
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
}

export async function getNotificationCountAction(): Promise<number> {
  const user = await getAuthUser();
  if (!user) return 0;

  try {
    const { getUnreadCount } =
      await import("@/services/notifications/notification-service");
    return await getUnreadCount(user.id);
  } catch {
    return 0;
  }
}

export async function markNotificationReadAction(
  notificationId: string,
): Promise<ProfileActionResult> {
  const user = await getAuthUser();
  if (!user) return { ok: false, error: "Please sign in." };

  try {
    const { markAsRead } =
      await import("@/services/notifications/notification-service");
    await markAsRead(user.id, notificationId);
    return { ok: true, message: "Marked as read." };
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
}

export async function markAllNotificationsReadAction(): Promise<ProfileActionResult> {
  const user = await getAuthUser();
  if (!user) return { ok: false, error: "Please sign in." };

  try {
    const { markAllAsRead } =
      await import("@/services/notifications/notification-service");
    await markAllAsRead(user.id);
    revalidatePath("/account");
    return { ok: true, message: "All notifications marked as read." };
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
}

/* ---------------------------------------------------------------------------
 * Admin order actions
 * --------------------------------------------------------------------- */

export type AdminOrderListResult =
  | {
      ok: true;
      orders: Awaited<
        ReturnType<
          typeof import("@/services/orders/order-service").listAllOrders
        >
      >["orders"];
      total: number;
    }
  | { ok: false; error: string };

export async function getAdminOrdersAction(options?: {
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<AdminOrderListResult> {
  const user = await getAuthUser();
  if (!user || user.role !== "admin")
    return { ok: false, error: "Admin access required." };

  try {
    const { listAllOrders } = await import("@/services/orders/order-service");
    const result = await listAllOrders(
      { id: user.id, role: user.role },
      options as Parameters<typeof listAllOrders>[1],
    );
    return { ok: true, orders: result.orders, total: result.total };
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
}

export async function getAdminOrderDetailAction(orderId: string) {
  const user = await getAuthUser();
  if (!user || user.role !== "admin")
    return { ok: false as const, error: "Admin access required." };

  try {
    const { getAdminOrderDetail } =
      await import("@/services/orders/order-service");
    const order = await getAdminOrderDetail(
      { id: user.id, role: user.role },
      orderId,
    );
    return { ok: true as const, order };
  } catch (error) {
    return { ok: false as const, error: errorText(error) };
  }
}

export async function updateOrderStatusAction(
  orderId: string,
  newStatus: string,
  note?: string,
): Promise<ProfileActionResult> {
  const user = await getAuthUser();
  if (!user || user.role !== "admin")
    return { ok: false, error: "Admin access required." };

  try {
    const { updateOrderStatus } =
      await import("@/services/orders/order-service");
    await updateOrderStatus(
      { id: user.id, role: user.role },
      orderId,
      newStatus as import("@/lib/supabase/types").OrderStatus,
      note,
    );
    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath("/orders");
    return { ok: true, message: `Order status updated to "${newStatus}".` };
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
}

function revalidatePaths(paths: string[] = []): void {
  for (const path of paths) {
    revalidatePath(path);
  }
}

/** Sign out from the storefront. */
export async function signOutAction(): Promise<void> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  // Awaited on purpose: the refresh token must be revoked and the auth cookies
  // expired in the response, otherwise the action resolves with a live session.
  await supabase.auth.signOut();
}

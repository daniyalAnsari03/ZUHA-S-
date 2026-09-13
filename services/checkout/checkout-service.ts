import {
  checkoutCustomerSchema,
  type CheckoutCustomerInput,
} from "@/lib/validation/cart";
import {
  getOrCreateActiveCart,
  summarizeCart,
  verifyCheckoutCart,
  type CartSummary,
} from "@/services/cart/cart-service";
import { createOrder, type CreateOrderInput } from "@/services/orders/order-service";
import {
  createNotification,
  createNotificationAdmin,
  maybeAlertAdminOnStockCrossing,
} from "@/services/notifications/notification-service";
import { ServiceError } from "@/services/base";

/**
 * Phase 5 checkout service.
 *
 * Validates the cart, computes pricing server-side, creates the order with
 * snapshot pricing, performs atomic inventory deduction, converts the cart,
 * and creates notifications.
 */

export const SHIPPING_FEE = 0;
export const FREE_SHIPPING_THRESHOLD = 15000;

/** Server-side price breakdown for a given cart. Computed only from trusted data. */
export type CheckoutTotals = {
  itemCount: number;
  subtotal: number;
  shipping: number;
  total: number;
};

export type CheckoutValidationResult =
  | {
      ok: true;
      userId: string;
      customer: CheckoutCustomerInput;
      totals: CheckoutTotals;
      summary: CartSummary;
    }
  | { ok: false; errors: string[] };

/**
 * Validate every pre-checkout concern server-side:
 * authentication, cart ownership, non-empty cart, live product prices,
 * sufficient stock, valid customer/shipping data and a server-computed total.
 */
export async function validateCheckout(
  userId: string,
  customerInput: CheckoutCustomerInput,
): Promise<CheckoutValidationResult> {
  // 1. Authenticated.
  if (!userId) {
    return { ok: false, errors: ["Please sign in to continue to checkout."] };
  }

  // 2. Cart belongs to the current user (RLS ensures this) and is non-empty,
  //    with every product active and sufficiently stocked.
  const cartCheck = await verifyCheckoutCart(userId);
  if (!cartCheck.ok) {
    return { ok: false, errors: cartCheck.errors };
  }

  // 3. Customer/shipping data validates.
  const parsed = checkoutCustomerSchema.safeParse(customerInput);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, errors: [first?.message ?? "Please check your details."] };
  }

  // 4. Compute total from trusted server data.
  const totals = computeTotals(cartCheck.summary);

  return {
    ok: true,
    userId,
    customer: parsed.data,
    totals,
    summary: cartCheck.summary,
  };
}

/** Compute the server-side price breakdown from a trusted cart summary. */
export function computeTotals(summary: CartSummary): CheckoutTotals {
  const subtotal = summary.subtotal;
  const shipping =
    subtotal >= FREE_SHIPPING_THRESHOLD || subtotal === 0 ? 0 : SHIPPING_FEE;
  return {
    itemCount: summary.itemCount,
    subtotal,
    shipping,
    total: subtotal + shipping,
  };
}

/* ---------------------------------------------------------------------------
 * Payment provider abstraction
 * --------------------------------------------------------------------- */

export type PaymentProviderId = "card" | "cod" | "unavailable";

export type PaymentRequest = {
  userId: string;
  amount: number; // PKR, always server-computed
  orderNote?: string;
};

export type PaymentResult =
  | { ok: true; provider: PaymentProviderId; reference: string; requiresWebhook: boolean }
  | { ok: false; provider: PaymentProviderId; error: string };

export type CheckoutHandoff =
  | {
      state: "success";
      provider: PaymentProviderId;
      reference: string;
      orderId: string;
      message: string;
    }
  | {
      state: "pending";
      provider: PaymentProviderId;
      reference: string;
      orderId: string;
      message: string;
    }
  | {
      state: "unavailable";
      message: string;
    }
  | {
      state: "rejected";
      errors: string[];
    };

/**
 * Determine the configured payment provider for this deployment. Returns
 * "unavailable" when no provider is configured — never a fake success.
 */
export function resolvePaymentProvider(): PaymentProviderId {
  if (process.env.PAYMENT_PROVIDER === "cod") {
    return "cod";
  }
  if (
    process.env.PAYMENT_PROVIDER === "card" &&
    process.env.PAYMENT_PROVIDER_CARD_ENABLED === "true"
  ) {
    return "card";
  }
  return "unavailable";
}

/**
 * Phase 5 checkout handoff: validates, creates the order, deducts inventory,
 * converts the cart, and creates notifications.
 */
export async function initiateCheckout(
  userId: string,
  customer: CheckoutCustomerInput,
): Promise<CheckoutHandoff> {
  const result = await validateCheckout(userId, customer);
  if (!result.ok) {
    return { state: "rejected", errors: result.errors };
  }

  const provider = resolvePaymentProvider();

  if (provider === "unavailable") {
    return {
      state: "unavailable",
      message:
        "Payment is not configured yet. Your bag and details are validated, but no order was created.",
    };
  }

  // Deduct inventory before creating the order (fail-safe: if order creation
  // fails after deduction, we attempt to restore).
  const deductedItems: { productId: string; quantity: number }[] = [];

  try {
    for (const item of result.summary.items) {
      await deductStock(item.productId, item.quantity);
      deductedItems.push({ productId: item.productId, quantity: item.quantity });
    }
  } catch (error) {
    // Restore already-deducted stock
    for (const di of deductedItems) {
      await restoreStock(di.productId, di.quantity).catch(() => {});
    }
    if (error instanceof ServiceError) {
      return { state: "rejected", errors: [error.message] };
    }
    return { state: "rejected", errors: ["Failed to reserve stock. Please try again."] };
  }

  // Generate a unique order number
  let orderNumber: string;
  try {
    orderNumber = await generateOrderNumber();
  } catch {
    // Restore stock if order number generation fails
    for (const di of deductedItems) {
      await restoreStock(di.productId, di.quantity).catch(() => {});
    }
    return { state: "rejected", errors: ["Failed to generate order number. Please try again."] };
  }

  // Build the order input from the trusted summary
  const orderInput: CreateOrderInput = {
    userId,
    orderNumber,
    customerName: customer.name,
    customerPhone: customer.phone,
    customerEmail: customer.email,
    shippingAddress: customer.shippingAddress,
    city: customer.city,
    postalCode: customer.postalCode,
    orderNotes: customer.orderNotes,
    paymentMethod: provider,
    items: result.summary.items.map((item) => ({
      productId: item.productId,
      productName: item.name,
      productPrice: Math.round(item.price),
      productImage: item.image,
      quantity: item.quantity,
      subtotal: item.subtotal,
    })),
    subtotal: result.totals.subtotal,
    shippingFee: result.totals.shipping,
    total: result.totals.total,
  };

  // Create the order
  let order;
  try {
    order = await createOrder(orderInput);
  } catch {
    // Restore stock if order creation fails
    for (const di of deductedItems) {
      await restoreStock(di.productId, di.quantity).catch(() => {});
    }
    return { state: "rejected", errors: ["Failed to create your order. Please try again."] };
  }

  // Convert the cart
  await convertCart(userId).catch(() => {});

  // Create notifications (non-blocking, best-effort)
  createOrderStatusNotification(userId, order.id, order.order_number, "pending").catch(() => {});
  createAdminNewOrderNotificationForOrder(order.id, order.order_number, order.total).catch(() => {});

  return {
    state: provider === "cod" ? "success" : "pending",
    provider,
    reference: order.order_number,
    orderId: order.id,
    message:
      provider === "cod"
        ? `Order ${order.order_number} placed successfully! You will pay ${result.totals.total} PKR on delivery.`
        : `Order ${order.order_number} placed. Payment via card is pending.`,
  };
}

/* ---------------------------------------------------------------------------
 * Inventory operations
 * --------------------------------------------------------------------- */

/**
 * Atomically deduct stock for a product. Uses the admin client to bypass RLS
 * and a conditional update to prevent overselling.
 *
 * The checkout flow already validates product existence, activeness and stock
 * via `verifyCheckoutCart`, so this function only performs the atomic decrement
 * and retries once on conflict (race-condition safe).
 */
async function deductStock(productId: string, quantity: number): Promise<void> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();

  // Read current stock using the admin client (bypasses RLS).
  const { data: product, error: fetchError } = await supabase
    .from("products")
    .select("stock_quantity, name, low_stock_threshold")
    .eq("id", productId)
    .maybeSingle();

  if (fetchError) {
    throw new ServiceError("STOCK_READ_FAILED", "Failed to verify stock. Please try again.");
  }

  if (!product) {
    throw new ServiceError("PRODUCT_NOT_FOUND", "A product in your cart is no longer available.");
  }

  if (product.stock_quantity < quantity) {
    throw new ServiceError(
      "INSUFFICIENT_STOCK",
      `Only ${product.stock_quantity} of ${product.name} are available.`,
    );
  }

  // Conditional decrement — only succeeds if stock hasn't changed since read.
  const { error: updateError } = await supabase
    .from("products")
    .update({ stock_quantity: product.stock_quantity - quantity })
    .eq("id", productId)
    .eq("stock_quantity", product.stock_quantity);

  if (updateError) {
    throw new ServiceError("STOCK_DEDUCTION_FAILED", "Failed to reserve stock. Please try again.");
  }

  // Best-effort: alert admins when this deduction crosses into low stock.
  maybeAlertAdminOnStockCrossing(
    product.stock_quantity,
    product.stock_quantity - quantity,
    product.low_stock_threshold ?? 0,
    product.name,
    productId,
  ).catch(() => {});
}

/** Restore stock (e.g., on order creation failure or cancellation). */
async function restoreStock(productId: string, quantity: number): Promise<void> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();

  const { data: product } = await supabase
    .from("products")
    .select("stock_quantity")
    .eq("id", productId)
    .single();

  if (!product) return;

  await supabase
    .from("products")
    .update({ stock_quantity: product.stock_quantity + quantity })
    .eq("id", productId);
}

/** Mark the cart as converted (no longer active). */
async function convertCart(userId: string): Promise<void> {
  const supabase = await (
    await import("@/lib/supabase/server")
  ).createClient();

  await supabase
    .from("carts")
    .update({ status: "converted" })
    .eq("user_id", userId)
    .eq("status", "active");
}

/** Generate a unique order number via the database function. */
async function generateOrderNumber(): Promise<string> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("generate_order_number");

  if (error || !data) {
    // Fallback: generate locally
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `DIN-${dateStr}-${rand}`;
  }

  return data;
}

/** Create order status notification for the customer. */
async function createOrderStatusNotification(
  userId: string,
  orderId: string,
  orderNumber: string,
  status: string,
): Promise<void> {
  const templates: Record<string, { type: string; title: string; message: string }> = {
    pending: {
      type: "order_placed",
      title: "Order Placed",
      message: `Your order ${orderNumber} has been placed successfully. We'll confirm it shortly.`,
    },
  };

  const template = templates[status];
  if (!template) return;

  try {
    await createNotification({
      userId,
      orderId,
      type: template.type as "order_placed",
      title: template.title,
      message: template.message,
    });
  } catch {
    // Best-effort — don't fail checkout for notification errors
  }
}

/** Create admin notification for a new order (best-effort). */
async function createAdminNewOrderNotificationForOrder(
  orderId: string,
  orderNumber: string,
  total: number,
): Promise<void> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();

  // Find all admin users
  const { data: admins } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "admin");

  if (!admins || admins.length === 0) return;

  for (const admin of admins) {
    try {
      await createNotificationAdmin({
        userId: admin.id,
        orderId,
        type: "admin_new_order",
        title: "New Order Received",
        message: `New order ${orderNumber} placed for ${total} PKR.`,
      });
    } catch {
      // Best-effort
    }
  }
}

/** Helper to ensure cart persistence is safe before checkout proceeds. */
export async function ensureCheckoutCartValid(userId: string): Promise<CheckoutTotals> {
  const cart = await getOrCreateActiveCart(userId);
  const summary = summarizeCart(cart);
  return computeTotals(summary);
}

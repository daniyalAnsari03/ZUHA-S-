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

/**
 * Phase 4 checkout foundation.
 *
 * This module owns the secure checkout boundary. It revalidates the cart
 * against trusted product data, computes pricing entirely server-side, and
 * hands off to a payment provider through an abstraction. It does NOT build
 * the Phase 5 order-management system — that belongs to a later phase.
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
 *
 * Phase 4 deliberately does NOT lock the project to a single provider or claim
 * a fake payment success. A provider is selected if configured via env vars;
 * otherwise checkout surfaces a clear "not configured yet" state. No secrets
 * ever reach the client. Phase 5+ wires a concrete Pakistani provider.
 * ------------------------------------------------------------------------- */

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
      message: string;
    }
  | {
      state: "pending";
      provider: PaymentProviderId;
      reference: string;
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
 * Record the Phase 4 checkout handoff. In this phase we validate and compute
 * the server-side total, then surface a safe provider state. Full order
 * persistence and provider webhook verification land in Phase 5.
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

  // Keep a cart summary snapshot for reference; no order row is persisted in
  // Phase 4. The provider reference is generated server-side and the final
  // amount is the server-computed total.
  const reference = `CHK-${Date.now()}-${userId.slice(0, 8)}`;

  return {
    state: "pending",
    provider,
    reference,
    message: `Payment via ${provider === "cod" ? "Cash on Delivery" : "Card"} pending configuration for order ${reference}.`,
  };
}

/** Helper to ensure cart persistence is safe before checkout proceeds. */
export async function ensureCheckoutCartValid(userId: string): Promise<CheckoutTotals> {
  const cart = await getOrCreateActiveCart(userId);
  const summary = summarizeCart(cart);
  return computeTotals(summary);
}

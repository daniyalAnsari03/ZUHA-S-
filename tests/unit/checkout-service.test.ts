import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  computeTotals,
  FREE_SHIPPING_THRESHOLD,
  resolvePaymentProvider,
  SHIPPING_FEE,
} from "@/services/checkout/checkout-service";

/**
 * Checkout service unit tests. These target the pure, security-relevant logic:
 * server-side pricing and provider resolution. Anything requiring a database
 * (validateCheckout → verifyCheckoutCart) is intentionally not faked here —
 * those paths must run against the real RLS-protected DB.
 */

const summary = {
  cartId: "cart-1",
  itemCount: 4,
  subtotal: 40000,
  items: [],
};

describe("computeTotals", () => {
  it("computes item count, subtotal, shipping and total server-side", () => {
    const totals = computeTotals(summary);
    expect(totals.itemCount).toBe(4);
    expect(totals.subtotal).toBe(40000);
    expect(totals.shipping).toBe(SHIPPING_FEE);
    expect(totals.total).toBe(40000 + SHIPPING_FEE);
  });

  it("applies free shipping at/above the threshold", () => {
    expect(computeTotals({ ...summary, subtotal: FREE_SHIPPING_THRESHOLD }).shipping).toBe(
      0,
    );
    expect(
      computeTotals({ ...summary, subtotal: FREE_SHIPPING_THRESHOLD + 100 }).shipping,
    ).toBe(0);
  });

  it("returns zero totals for an empty cart", () => {
    const totals = computeTotals({ ...summary, subtotal: 0, itemCount: 0 });
    expect(totals).toEqual({ itemCount: 0, subtotal: 0, shipping: 0, total: 0 });
  });
});

describe("resolvePaymentProvider", () => {
  const originalProvider = process.env.PAYMENT_PROVIDER;
  const originalCardEnabled = process.env.PAYMENT_PROVIDER_CARD_ENABLED;

  beforeEach(() => {
    delete process.env.PAYMENT_PROVIDER;
    delete process.env.PAYMENT_PROVIDER_CARD_ENABLED;
  });

  afterEach(() => {
    if (originalProvider === undefined) delete process.env.PAYMENT_PROVIDER;
    else process.env.PAYMENT_PROVIDER = originalProvider;
    if (originalCardEnabled === undefined)
      delete process.env.PAYMENT_PROVIDER_CARD_ENABLED;
    else process.env.PAYMENT_PROVIDER_CARD_ENABLED = originalCardEnabled;
  });

  it("reports unavailable when no provider is configured (never a fake success)", () => {
    expect(resolvePaymentProvider()).toBe("unavailable");
  });

  it("reports cod when PAYMENT_PROVIDER=cod", () => {
    process.env.PAYMENT_PROVIDER = "cod";
    expect(resolvePaymentProvider()).toBe("cod");
  });

  it("never resolves card unless explicitly enabled", () => {
    process.env.PAYMENT_PROVIDER = "card";
    expect(resolvePaymentProvider()).toBe("unavailable");

    process.env.PAYMENT_PROVIDER_CARD_ENABLED = "true";
    expect(resolvePaymentProvider()).toBe("card");
  });
});
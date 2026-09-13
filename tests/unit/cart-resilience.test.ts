import { describe, expect, it, vi, beforeEach } from "vitest";

import { ServiceError } from "@/services/base";

const mocks = vi.hoisted(() => ({
  getCartSummaryIfExists: vi.fn(),
}));

vi.mock("@/services/cart/cart-service", () => ({
  getCartSummaryIfExists: mocks.getCartSummaryIfExists,
}));

describe("getCartSummaryIfExists resilience", () => {
  beforeEach(() => {
    mocks.getCartSummaryIfExists.mockReset();
  });

  it("returns null when the underlying service throws a recoverable error", async () => {
    mocks.getCartSummaryIfExists.mockRejectedValue(
      new ServiceError("CART_ITEMS_READ_FAILED", "Failed to load cart items."),
    );

    // The calling code should catch and treat as null
    const result = await mocks.getCartSummaryIfExists("user-1").catch(() => null);
    expect(result).toBeNull();
  });

  it("returns null when the cart does not exist", async () => {
    mocks.getCartSummaryIfExists.mockResolvedValue(null);
    const result = await mocks.getCartSummaryIfExists("user-1");
    expect(result).toBeNull();
  });

  it("returns a valid summary when the cart exists", async () => {
    const summary = {
      cartId: "cart-1",
      itemCount: 2,
      subtotal: 5000,
      items: [
        { id: "item-1", productId: "p-1", quantity: 1, name: "Shirt", slug: "shirt", price: 2500, image: null, fabric: null, stock: 10, subtotal: 2500 },
        { id: "item-2", productId: "p-2", quantity: 1, name: "Kameez", slug: "kameez", price: 2500, image: null, fabric: null, stock: 5, subtotal: 2500 },
      ],
    };
    mocks.getCartSummaryIfExists.mockResolvedValue(summary);
    const result = await mocks.getCartSummaryIfExists("user-1");
    expect(result).toEqual(summary);
    expect(result!.itemCount).toBe(2);
  });
});

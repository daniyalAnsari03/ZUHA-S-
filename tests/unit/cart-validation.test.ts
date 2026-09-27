import { describe, expect, it } from "vitest";

import {
  addToCartSchema,
  checkoutCustomerSchema,
  removeCartItemSchema,
  toggleWishlistSchema,
  updateCartItemSchema,
} from "@/lib/validation/cart";

const PRODUCT_ID = "00000000-0000-4000-8000-000000000000";
const ITEM_ID = "11111111-1111-4111-8111-111111111111";

describe("addToCartSchema", () => {
  it("accepts a valid product id and quantity", () => {
    const result = addToCartSchema.safeParse({
      productId: PRODUCT_ID,
      quantity: 1,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a quantity of zero or negative", () => {
    expect(
      addToCartSchema.safeParse({ productId: PRODUCT_ID, quantity: 0 }).success,
    ).toBe(false);
    expect(
      addToCartSchema.safeParse({ productId: PRODUCT_ID, quantity: -2 })
        .success,
    ).toBe(false);
  });

  it("rejects a non-integer or unreasonably large quantity", () => {
    expect(
      addToCartSchema.safeParse({ productId: PRODUCT_ID, quantity: 1.5 })
        .success,
    ).toBe(false);
    expect(
      addToCartSchema.safeParse({ productId: PRODUCT_ID, quantity: 5000 })
        .success,
    ).toBe(false);
  });

  it("rejects a malformed product id", () => {
    expect(
      addToCartSchema.safeParse({ productId: "not-a-uuid", quantity: 1 })
        .success,
    ).toBe(false);
  });
});

describe("updateCartItemSchema", () => {
  it("accepts a valid item id and quantity", () => {
    expect(
      updateCartItemSchema.safeParse({ itemId: ITEM_ID, quantity: 3 }).success,
    ).toBe(true);
  });

  it("rejects an invalid quantity", () => {
    expect(
      updateCartItemSchema.safeParse({ itemId: ITEM_ID, quantity: 0 }).success,
    ).toBe(false);
  });

  it("rejects a malformed item id", () => {
    expect(
      updateCartItemSchema.safeParse({ itemId: "x", quantity: 2 }).success,
    ).toBe(false);
  });
});

describe("removeCartItemSchema / toggleWishlistSchema", () => {
  it("validates ids strictly", () => {
    expect(removeCartItemSchema.safeParse({ itemId: ITEM_ID }).success).toBe(
      true,
    );
    expect(removeCartItemSchema.safeParse({ itemId: "bad" }).success).toBe(
      false,
    );
    expect(
      toggleWishlistSchema.safeParse({ productId: PRODUCT_ID }).success,
    ).toBe(true);
    expect(toggleWishlistSchema.safeParse({ productId: "bad" }).success).toBe(
      false,
    );
  });
});

describe("checkoutCustomerSchema", () => {
  const validCustomer = {
    name: "Ali Raza",
    phone: "03001234567",
    email: "ali@example.com",
    shippingAddress: "House 44, Main Boulevard",
    city: "Lahore",
  };

  it("accepts a valid Pakistani customer payload", () => {
    expect(checkoutCustomerSchema.safeParse(validCustomer).success).toBe(true);
  });

  it("accepts +92 and 03 phone prefixes", () => {
    expect(
      checkoutCustomerSchema.safeParse({
        ...validCustomer,
        phone: "+923001234567",
      }).success,
    ).toBe(true);
    expect(
      checkoutCustomerSchema.safeParse({
        ...validCustomer,
        phone: "03451234567",
      }).success,
    ).toBe(true);
  });

  it("rejects a missing name", () => {
    const input = { ...validCustomer, name: "   " };
    const result = checkoutCustomerSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("rejects an invalid Pakistani phone number", () => {
    for (const phone of ["12345", "0300123456", "991234567890", "abc"]) {
      expect(
        checkoutCustomerSchema.safeParse({ ...validCustomer, phone }).success,
      ).toBe(false);
    }
  });

  it("rejects an invalid email", () => {
    expect(
      checkoutCustomerSchema.safeParse({ ...validCustomer, email: "nope" })
        .success,
    ).toBe(false);
  });

  it("rejects a missing shipping address or city", () => {
    expect(
      checkoutCustomerSchema.safeParse({
        ...validCustomer,
        shippingAddress: "",
      }).success,
    ).toBe(false);
    expect(
      checkoutCustomerSchema.safeParse({ ...validCustomer, city: "" }).success,
    ).toBe(false);
  });

  it("allows optional postal code and order notes", () => {
    const result = checkoutCustomerSchema.safeParse({
      ...validCustomer,
      postalCode: "54800",
      orderNotes: "Please deliver after 5pm.",
    });
    expect(result.success).toBe(true);
  });
});

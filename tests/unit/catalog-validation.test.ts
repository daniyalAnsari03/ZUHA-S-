import { describe, expect, it } from "vitest";

import {
  categoryInputSchema,
  productInputSchema,
  stockUpdateSchema,
} from "@/lib/validation/catalog";

describe("categoryInputSchema", () => {
  it("accepts a valid category", () => {
    const result = categoryInputSchema.safeParse({
      name: "Jamawar",
      slug: "jamawar",
      description: "Hand-woven jamawar",
      isActive: true,
      sortOrder: 1,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid slug", () => {
    const result = categoryInputSchema.safeParse({
      name: "Jamawar",
      slug: "Bad Slug!",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing name", () => {
    const result = categoryInputSchema.safeParse({ slug: "jamawar" });
    expect(result.success).toBe(false);
  });
});

describe("productInputSchema", () => {
  it("accepts a valid product and applies defaults", () => {
    const result = productInputSchema.safeParse({
      name: "Khirke Jamawar",
      slug: "khirke-jamawar",
      price: 34500,
      stockQuantity: 12,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isActive).toBe(true);
      expect(result.data.isFeatured).toBe(false);
      expect(result.data.lowStockThreshold).toBe(5);
    }
  });

  it("rejects a negative price", () => {
    const result = productInputSchema.safeParse({
      name: "Khirke",
      slug: "khirke",
      price: -5,
      stockQuantity: 1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a negative stock quantity", () => {
    const result = productInputSchema.safeParse({
      name: "Khirke",
      slug: "khirke",
      price: 100,
      stockQuantity: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid slug pattern", () => {
    const result = productInputSchema.safeParse({
      name: "Khirke",
      slug: "Invalid Slug",
      price: 100,
      stockQuantity: 1,
    });
    expect(result.success).toBe(false);
  });
});

describe("stockUpdateSchema", () => {
  it("rejects a negative stock", () => {
    const result = stockUpdateSchema.safeParse({ stockQuantity: -1 });
    expect(result.success).toBe(false);
  });

  it("accepts a zero stock (out of stock)", () => {
    const result = stockUpdateSchema.safeParse({ stockQuantity: 0 });
    expect(result.success).toBe(true);
  });
});

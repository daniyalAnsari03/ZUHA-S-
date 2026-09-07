import { describe, expect, it } from "vitest";

import { ServiceError } from "@/services/base";
import {
  createCategory,
  setCategoryActive,
  updateCategory,
} from "@/services/categories/categories-service";
import {
  createProduct,
  deleteProduct,
  setProductActive,
  updateProduct,
  updateStock,
} from "@/services/products/products-service";

/**
 * Catalog service authorization tests.
 *
 * These verify the security boundary WITHOUT touching the database: mutation
 * services must reject non-admin roles before any client/DB work happens (the
 * `assertRole` guard runs first).
 */

const CUSTOMER = { id: "actor-2", role: "customer" as const };

const validCategory = {
  name: "Jamawar",
  slug: "jamawar",
  isActive: true,
  sortOrder: 1,
};

const validProduct = {
  name: "Khirke Jamawar",
  slug: "khirke-jamawar",
  price: 34500,
  stockQuantity: 12,
  lowStockThreshold: 5,
};

describe("category service authorization", () => {
  it("rejects a customer creating a category", async () => {
    await expect(createCategory(CUSTOMER, validCategory)).rejects.toThrow(
      ServiceError,
    );
    await expect(
      createCategory(CUSTOMER, validCategory),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects a customer updating/deactivating a category", async () => {
    await expect(
      updateCategory(CUSTOMER, "cat-1", validCategory),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      setCategoryActive(CUSTOMER, "cat-1", false),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("product service authorization", () => {
  it("rejects a customer creating a product", async () => {
    await expect(createProduct(CUSTOMER, validProduct)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("rejects a customer editing product data/stock", async () => {
    await expect(
      updateProduct(CUSTOMER, "prod-1", validProduct),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      updateStock(CUSTOMER, "prod-1", { stockQuantity: 5 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      setProductActive(CUSTOMER, "prod-1", false),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects a customer deleting a product", async () => {
    await expect(deleteProduct(CUSTOMER, "prod-1")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
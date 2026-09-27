import { describe, expect, it } from "vitest";

import { summarizeWishlist } from "@/services/wishlist/wishlist-service";

/**
 * Regression cover for the "wishlist saves but never appears" bug.
 *
 * The root cause was the embedded product coming back under the *table* key
 * (`products`) instead of the declared property (`product`), so every item was
 * filtered out of the summary. Because the generated `Database` types have no
 * relationship metadata, the compiler cannot catch that mismatch — these tests
 * pin the behaviour that matters: a saved, active product must be present in
 * the summary no matter which embed key the row uses.
 */

const product = {
  id: "product-1",
  name: "Buta Jaal Kurta",
  slug: "buta-jaal",
  price: 8400,
  stock_quantity: 12,
  image_url: "products/buta-jaal.jpeg",
  fabric: "Lawn",
  is_active: true,
};

function makeWishlist(items: unknown[]) {
  return {
    id: "wishlist-1",
    user_id: "user-1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    items,
  } as never;
}

describe("summarizeWishlist", () => {
  it("includes an item whose product is embedded under the declared `product` key", () => {
    const summary = summarizeWishlist(
      makeWishlist([
        {
          id: "item-1",
          wishlist_id: "wishlist-1",
          product_id: product.id,
          created_at: "2026-01-01T00:00:00.000Z",
          product,
        },
      ]),
    );

    expect(summary.itemCount).toBe(1);
    expect(summary.productIds).toEqual([product.id]);
    expect(summary.items[0]).toMatchObject({
      id: "item-1",
      productId: product.id,
      name: "Buta Jaal Kurta",
      slug: "buta-jaal",
      price: 8400,
      stock: 12,
    });
  });

  it("still excludes items whose embedded product is missing entirely", () => {
    const summary = summarizeWishlist(
      makeWishlist([
        {
          id: "item-1",
          wishlist_id: "wishlist-1",
          product_id: product.id,
          created_at: "2026-01-01T00:00:00.000Z",
        },
      ]),
    );

    expect(summary.itemCount).toBe(0);
    expect(summary.items).toEqual([]);
  });

  it("excludes items whose embedded product is inactive", () => {
    const summary = summarizeWishlist(
      makeWishlist([
        {
          id: "item-1",
          wishlist_id: "wishlist-1",
          product_id: product.id,
          created_at: "2026-01-01T00:00:00.000Z",
          product: { ...product, is_active: false },
        },
      ]),
    );

    expect(summary.itemCount).toBe(0);
  });

  it("handles an empty or malformed item list without throwing", () => {
    expect(summarizeWishlist(makeWishlist([])).itemCount).toBe(0);
    expect(summarizeWishlist(makeWishlist([null, undefined])).itemCount).toBe(0);
  });
});

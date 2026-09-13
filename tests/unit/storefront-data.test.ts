import { describe, expect, it } from "vitest";

import {
  getActiveAnnouncements,
  getActiveCategories,
  getActiveHeroSlides,
  getActiveProductSections,
  getAllActiveProducts,
  getCategoryBySlug,
  getProductBySlug,
  resolveProducts,
} from "@/lib/storefront/data";
import { categoryHref, discountPercent, formatPrice } from "@/lib/storefront/format";

describe("storefront data layer", () => {
  it("returns only active announcements in display order", async () => {
    const items = await getActiveAnnouncements();
    expect(items.length).toBeGreaterThan(0);
    const orders = items.map((a) => a.order);
    expect([...orders].sort((a, b) => a - b)).toEqual(orders);
    expect(items.every((a) => a.active)).toBe(true);
  });

  it("exposes an active hero slide", async () => {
    const slides = await getActiveHeroSlides();
    expect(slides.some((s) => s.active)).toBe(true);
  });

  it("exposes six active categories in display order", async () => {
    const items = await getActiveCategories();
    expect(items).toHaveLength(6);
    const orders = items.map((c) => c.order);
    expect([...orders].sort((a, b) => a - b)).toEqual(orders);
  });

  it("resolves a category by slug", async () => {
    expect((await getCategoryBySlug("jamawar"))?.name).toBe("Jamawar");
    expect(await getCategoryBySlug("missing")).toBeNull();
  });

  it("sections each curate four viewable products", async () => {
    const sections = await getActiveProductSections();
    expect(sections.length).toBe(7);
    for (const section of sections) {
      expect(await resolveProducts(section.productIds, 4)).toHaveLength(4);
    }
  });

  it("caps resolved products at the requested limit", async () => {
    const all = await getAllActiveProducts();
    expect(await resolveProducts(all.map((p) => p.id), 4)).toHaveLength(4);
  });

  it("resolves a product by slug with stock metadata", async () => {
    const product = await getProductBySlug("khirke-jamawar");
    expect(product).not.toBeNull();
    expect(product?.stockQuantity).toBeGreaterThanOrEqual(0);
    expect(product?.lowStockThreshold).toBeGreaterThanOrEqual(0);
  });

  it("formats prices as whole PKR", () => {
    expect(formatPrice(34500)).toBe("PKR 34,500");
    expect(formatPrice(9900)).toBe("PKR 9,900");
  });

  it("calculates a rounded discount only from a valid higher compare-at price", () => {
    expect(discountPercent(34500, 40000)).toBe(14);
    expect(discountPercent(500, 1000)).toBe(50);
  });

  it("never reports a discount without a valid higher compare-at price", () => {
    expect(discountPercent(34500, null)).toBeNull();
    expect(discountPercent(34500, undefined)).toBeNull();
    expect(discountPercent(34500, 0)).toBeNull();
    expect(discountPercent(34500, 34500)).toBeNull();
    expect(discountPercent(34500, 30000)).toBeNull();
  });

  it("reports a truthful discount for an underpriced/free item", () => {
    expect(discountPercent(0, 40000)).toBe(100);
  });

  it("keeps decimal prices safely formatted and discounts finite", () => {
    expect(formatPrice(34500.5)).toBe("PKR 34,501");
    const percent = discountPercent(34500.5, 40000);
    expect(percent).toBeTypeOf("number");
    expect(Number.isFinite(percent)).toBe(true);
  });

  it("builds category shop links", () => {
    expect(categoryHref("cut-dana")).toBe("/shop?category=cut-dana");
  });
});

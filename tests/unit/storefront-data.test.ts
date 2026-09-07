import { describe, expect, it } from "vitest";

import {
  getActiveAnnouncements,
  getActiveCategories,
  getActiveHeroSlides,
  getActiveProductSections,
  getAllActiveProducts,
  getCategoryBySlug,
  resolveProducts,
} from "@/lib/storefront/data";
import { categoryHref, formatPrice } from "@/lib/storefront/format";

describe("storefront data layer", () => {
  it("returns only active announcements in display order", () => {
    const items = getActiveAnnouncements();
    expect(items.length).toBeGreaterThan(0);
    const orders = items.map((a) => a.order);
    expect([...orders].sort((a, b) => a - b)).toEqual(orders);
    expect(items.every((a) => a.active)).toBe(true);
  });

  it("exposes an active hero slide", () => {
    const slides = getActiveHeroSlides();
    expect(slides.some((s) => s.active)).toBe(true);
  });

  it("exposes six active categories in display order", () => {
    const items = getActiveCategories();
    expect(items).toHaveLength(6);
    const orders = items.map((c) => c.order);
    expect([...orders].sort((a, b) => a - b)).toEqual(orders);
  });

  it("resolves a category by slug", () => {
    expect(getCategoryBySlug("jamawar")?.name).toBe("Jamawar");
    expect(getCategoryBySlug("missing")).toBeNull();
  });

  it("sections each curate four viewable products", () => {
    const sections = getActiveProductSections();
    expect(sections.length).toBe(7);
    for (const section of sections) {
      expect(resolveProducts(section.productIds, 4)).toHaveLength(4);
    }
  });

  it("caps resolved products at the requested limit", () => {
    const all = getAllActiveProducts();
    expect(resolveProducts(all.map((p) => p.id), 4)).toHaveLength(4);
  });

  it("formats prices as whole PKR", () => {
    expect(formatPrice(34500)).toBe("PKR 34,500");
    expect(formatPrice(9900)).toBe("PKR 9,900");
  });

  it("builds category shop links", () => {
    expect(categoryHref("cut-dana")).toBe("/shop?category=cut-dana");
  });
});
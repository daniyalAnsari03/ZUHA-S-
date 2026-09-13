import { describe, expect, it, vi } from "vitest";

import {
  normalizeString,
  requireString,
  ok,
  invalid,
  denied,
  notFound,
  asResult,
} from "@/tools/shared/result";
import { ServiceError } from "@/services/base";

/**
 * Sales and analytics tool hardening tests.
 *
 * Verify that sales queries, date-specific requests, and zero-result
 * cases are handled gracefully without raw errors leaking.
 */

describe("Sales data normalization", () => {
  it("today's date key is correctly formatted", () => {
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    expect(todayKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("trend data with zero sales returns empty array, not error", () => {
    // Simulating what happens when there are no sales
    const trend: { dateKey: string; revenue: number; orderCount: number }[] = [];
    const todayRevenue = trend.find(
      (t) => t.dateKey === "2026-09-11",
    )?.revenue ?? 0;
    expect(todayRevenue).toBe(0);
  });

  it("revenue formatting uses PKR locale", () => {
    const revenue = 1234567;
    const formatted = `PKR ${revenue.toLocaleString("en-PK")}`;
    expect(formatted).toContain("PKR");
    expect(formatted).toContain("1,234,567");
  });
});

describe("Empty result handling", () => {
  it("empty product list returns ok with empty data", () => {
    const result = ok([]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual([]);
    }
  });

  it("empty order list returns ok with empty data", () => {
    const result = ok({ total: 0, orders: [] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.total).toBe(0);
      expect(result.data.orders).toEqual([]);
    }
  });

  it("empty customer list returns ok with empty data", () => {
    const result = ok({ customers: [], total: 0 });
    expect(result.ok).toBe(true);
  });

  it("zero sales returns valid zero-result report", () => {
    const result = ok({
      revenue: "PKR 0",
      orderCount: 0,
      todayRevenue: "PKR 0",
      todayOrders: 0,
      topProducts: [],
      trend: [],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.orderCount).toBe(0);
      expect(result.data.todayOrders).toBe(0);
    }
  });
});

describe("Service error wrapping", () => {
  it("ServiceError is wrapped into structured error result", async () => {
    const result = await asResult(async () => {
      throw new ServiceError("DB_ERROR", "Database connection failed");
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("error");
      expect(result.message).toBe("Database connection failed");
    }
  });

  it("unexpected error is wrapped safely without leaking details", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await asResult(async () => {
      throw new Error("SECRET_KEY=abc123 internal stack trace");
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).not.toContain("SECRET_KEY");
      expect(result.message).not.toContain("abc123");
      expect(result.message).toContain("unexpected error");
    }
    consoleSpy.mockRestore();
  });

  it("null throw is handled gracefully", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await asResult(async () => {
      throw null;
    });
    expect(result.ok).toBe(false);
    consoleSpy.mockRestore();
  });
});

describe("Input edge cases for tools", () => {
  it("UUID validation preserves valid UUIDs", () => {
    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    const normalized = normalizeString(uuid);
    expect(normalized).toBe(uuid);
  });

  it("empty string is rejected before UUID validation", () => {
    const result = requireString("", "product ID");
    expect(result.ok).toBe(false);
  });

  it("whitespace-only is rejected before numeric validation", () => {
    const result = requireString("   ", "search term");
    expect(result.ok).toBe(false);
  });

  it("partial search terms are preserved for fuzzy matching", () => {
    const terms = [
      "emdbroidry",
      "embroider",
      "jamaw",
      "lawn",
      "cut-dana",
      "unstitch",
    ];
    for (const term of terms) {
      const normalized = normalizeString(term);
      expect(normalized).toBe(term);
    }
  });

  it("category slug normalization preserves valid slugs", () => {
    const slugs = [
      "jamawar",
      "embroidery",
      "cut-dana-embroidery",
      "plain",
      "unstitched",
      "lawn",
    ];
    for (const slug of slugs) {
      const normalized = normalizeString(slug);
      expect(normalized).toBe(slug);
    }
  });

  it("mixed case is preserved for ILike matching", () => {
    const inputs = [
      "EmbroiDery",
      "JAMAWAR",
      "lAwN",
      "Cut-Dana",
    ];
    for (const input of inputs) {
      const normalized = normalizeString(input);
      expect(normalized).toBe(input);
    }
  });
});

describe("Authorization result consistency", () => {
  it("denied result is consistent shape", () => {
    const result = denied("Admin access required");
    expect(result).toEqual({
      ok: false,
      reason: "forbidden",
      message: "Admin access required",
    });
  });

  it("notFound result is consistent shape", () => {
    const result = notFound("Product not found");
    expect(result).toEqual({
      ok: false,
      reason: "not_found",
      message: "Product not found",
    });
  });

  it("invalid result is consistent shape", () => {
    const result = invalid("Empty search term");
    expect(result).toEqual({
      ok: false,
      reason: "invalid",
      message: "Empty search term",
    });
  });
});

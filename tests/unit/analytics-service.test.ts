import { describe, expect, it } from "vitest";

import {
  computeActiveOrderCount,
  computeRevenue,
  computeSalesTrend,
  computeStatusDistribution,
  computeTopProducts,
  isExcludedFromRevenue,
} from "@/services/analytics/analytics-service";

/**
 * Analytics pure-logic tests. These encode the documented revenue rule:
 * cancelled / failed / refunded orders never count toward business value.
 * Database-dependent fetchers are intentionally not faked here.
 */

const baseOrder = {
  id: "o",
  order_number: "DIN-0001",
  customer_name: "Ayesha",
  total: 1000,
  status: "delivered" as const,
  payment_status: "paid" as const,
  created_at: new Date().toISOString(),
};

describe("revenue rule", () => {
  it("includes paid, delivered orders", () => {
    expect(isExcludedFromRevenue("delivered", "paid")).toBe(false);
    expect(computeRevenue([baseOrder])).toBe(1000);
  });

  it("excludes cancelled orders", () => {
    expect(isExcludedFromRevenue("cancelled", "paid")).toBe(true);
    expect(computeRevenue([{ ...baseOrder, status: "cancelled" }])).toBe(0);
  });

  it("excludes failed and refunded payment states", () => {
    expect(isExcludedFromRevenue("delivered", "failed")).toBe(true);
    expect(isExcludedFromRevenue("delivered", "refunded")).toBe(true);
    expect(computeRevenue([{ ...baseOrder, payment_status: "failed" }])).toBe(0);
  });

  it("sums only qualifying orders", () => {
    const orders = [
      baseOrder,
      { ...baseOrder, total: 500, status: "shipped" as const },
      { ...baseOrder, total: 999, status: "cancelled" as const },
    ];
    expect(computeRevenue(orders)).toBe(1500);
  });

  it("active order count matches revenue rule", () => {
    const orders = [
      baseOrder,
      { ...baseOrder, status: "cancelled" as const },
      { ...baseOrder, payment_status: "refunded" as const },
    ];
    expect(computeActiveOrderCount(orders)).toBe(1);
  });
});

describe("computeStatusDistribution", () => {
  it("returns every status with a zero default", () => {
    const dist = computeStatusDistribution([]);
    expect(dist).toHaveLength(6);
    expect(dist.every((d) => d.count === 0)).toBe(true);
  });

  it("counts each status", () => {
    const dist = computeStatusDistribution([
      { status: "delivered" },
      { status: "delivered" },
      { status: "pending" },
      { status: "cancelled" },
    ]);
    expect(dist.find((d) => d.status === "delivered")?.count).toBe(2);
    expect(dist.find((d) => d.status === "pending")?.count).toBe(1);
    expect(dist.find((d) => d.status === "cancelled")?.count).toBe(1);
  });
});

describe("computeSalesTrend", () => {
  it("zero-fills a full window of requested days", () => {
    const trend = computeSalesTrend([], 7);
    expect(trend).toHaveLength(7);
    expect(trend.every((p) => p.revenue === 0 && p.orderCount === 0)).toBe(true);
  });

  it("buckets revenue by local calendar day", () => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const order = {
      ...baseOrder,
      total: 2500,
      created_at: today.toISOString(),
    };
    const trend = computeSalesTrend([order], 7);
    const lastPoint = trend[trend.length - 1];
    expect(lastPoint.revenue).toBe(2500);
    expect(lastPoint.orderCount).toBe(1);
  });

  it("ignores non-qualifying orders in trend", () => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const orders = [
      { ...baseOrder, total: 100, created_at: today.toISOString() },
      {
        ...baseOrder,
        total: 900,
        status: "cancelled" as const,
        created_at: today.toISOString(),
      },
    ];
    const trend = computeSalesTrend(orders, 7);
    expect(trend[trend.length - 1].revenue).toBe(100);
  });
});

describe("computeTopProducts", () => {
  it("aggregates units and revenue by product", () => {
    const items = [
      {
        product_id: "p1",
        product_name: "Jamawar",
        quantity: 2,
        subtotal: 2000,
        order: { status: "delivered" as const, payment_status: "paid" as const },
      },
      {
        product_id: "p1",
        product_name: "Jamawar",
        quantity: 1,
        subtotal: 1000,
        order: { status: "delivered" as const, payment_status: "paid" as const },
      },
    ];
    const top = computeTopProducts(items);
    expect(top).toHaveLength(1);
    expect(top[0].unitsSold).toBe(3);
    expect(top[0].revenue).toBe(3000);
  });

  it("ignores items from cancelled orders", () => {
    const items = [
      {
        product_id: "p1",
        product_name: "Jamawar",
        quantity: 2,
        subtotal: 2000,
        order: { status: "cancelled" as const, payment_status: "paid" as const },
      },
    ];
    expect(computeTopProducts(items)).toHaveLength(0);
  });

  it("handles items whose order is missing", () => {
    const items = [
      {
        product_id: "p1",
        product_name: "Jamawar",
        quantity: 1,
        subtotal: 1000,
        order: null,
      },
    ];
    expect(computeTopProducts(items)).toHaveLength(0);
  });

  it("respects the limit", () => {
    const items = [1, 2, 3].map((n) => ({
      product_id: `p${n}`,
      product_name: `P${n}`,
      quantity: 1,
      subtotal: n * 100,
      order: { status: "delivered" as const, payment_status: "paid" as const },
    }));
    expect(computeTopProducts(items, 2)).toHaveLength(2);
  });
});
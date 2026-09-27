import { describe, expect, it } from "vitest";

import { computeCustomerSummary } from "@/services/customers/customers-service";

/**
 * Customer summary tests. They enforce the same documented revenue rule as the
 * admin dashboard: cancelled / failed / refunded orders never count toward a
 * customer's spend or active order count.
 */

const order = {
  id: "o1",
  status: "delivered" as const,
  payment_status: "paid" as const,
  total: 2000,
  created_at: "2026-09-01T10:00:00.000Z",
};

describe("computeCustomerSummary", () => {
  it("sums spend across qualifying orders", () => {
    const summary = computeCustomerSummary([
      order,
      { ...order, id: "o2", total: 500 },
    ]);
    expect(summary.orderCount).toBe(2);
    expect(summary.activeOrderCount).toBe(2);
    expect(summary.totalSpend).toBe(2500);
  });

  it("excludes cancelled, failed and refunded orders from spend", () => {
    const summary = computeCustomerSummary([
      order,
      { ...order, id: "o-c", status: "cancelled", total: 9999 },
      { ...order, id: "o-f", payment_status: "failed", total: 9999 },
      { ...order, id: "o-r", payment_status: "refunded", total: 9999 },
    ]);
    expect(summary.orderCount).toBe(4);
    expect(summary.activeOrderCount).toBe(1);
    expect(summary.totalSpend).toBe(2000);
  });

  it("reports the most recent order time", () => {
    const summary = computeCustomerSummary([
      order,
      { ...order, id: "o2", created_at: "2026-09-05T10:00:00.000Z" },
    ]);
    expect(summary.lastOrderAt).toBe("2026-09-05T10:00:00.000Z");
  });

  it("handles a customer with no orders", () => {
    const summary = computeCustomerSummary([]);
    expect(summary).toEqual({
      orderCount: 0,
      activeOrderCount: 0,
      totalSpend: 0,
      lastOrderAt: null,
    });
  });
});

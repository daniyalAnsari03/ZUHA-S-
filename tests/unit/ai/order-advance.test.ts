import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ServiceError } from "@/services/base";
import { advanceOrderStatus } from "@/services/orders/order-service";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
  createPublicClient: vi.fn(),
}));

import { createClient as mockCreateClient } from "@/lib/supabase/server";

/**
 * advanceOrderStatus — the combined-status guard.
 *
 * The bulk/combined path must run the SAME transition validation as the
 * single-order path: the whole chain is pre-validated BEFORE any write, each
 * step is applied as a guarded transition (expected previous status), and the
 * final status is verified with a fresh read before reporting success.
 */

const actor = { id: "admin-1", role: "admin" };

type MaybeSingleResult = { data: unknown; error: { message: string } | null };

function makeFakeFrom(results: MaybeSingleResult[]) {
  const inserts: Record<string, unknown[]> = { order_status_history: [] };

  const chainable = {
    eq: () => chainable,
    in: () => chainable,
    not: () => chainable,
    order: () => chainable,
    limit: () => chainable,
    select: () => chainable,
    insert: (value: unknown) => {
      const table = "order_status_history";
      inserts[table] = [...(inserts[table] ?? []), value];
      return { error: null };
    },
    update: () => {
      const updateChain = {
        eq: () => updateChain,
        select: () => updateChain,
        maybeSingle: () => Promise.resolve(results.shift() ?? { data: null, error: { message: "read fell off the queue" } }),
      };
      return updateChain;
    },
    maybeSingle: () => Promise.resolve(results.shift() ?? { data: null, error: { message: "read fell off the queue" } }),
    single: () => Promise.resolve(results.shift() ?? { data: null, error: { message: "read fell off the queue" } }),
  };

  const from = (table: string) => (table === "orders" ? chainable : chainable);
  return { from, inserts };
}

describe("advanceOrderStatus", () => {
  beforeEach(() => {
    vi.mocked(mockCreateClient).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects a chain that skips the mandatory confirmed step", async () => {
    // pending → processing is NOT valid on its own: must pass through confirmed.
    const fake = makeFakeFrom([{ data: { status: "pending" }, error: null }]);
    vi.mocked(mockCreateClient).mockResolvedValue(fake as never);

    await expect(
      advanceOrderStatus(actor, "order-1", ["processing" as never]),
    ).rejects.toMatchObject({
      name: "ServiceError",
      message: expect.stringContaining("Cannot advance order status from \"pending\" to \"processing\""),
    });
  });

  it("applies confirm+processing for a pending order and records both history steps", async () => {
    const fake = makeFakeFrom([
      { data: { status: "pending" }, error: null },
      { data: { status: "confirmed" }, error: null },
      { data: { status: "processing" }, error: null },
      { data: { status: "processing" }, error: null }, // verification read
    ]);
    vi.mocked(mockCreateClient).mockResolvedValue(fake as never);

    const result = await advanceOrderStatus(actor, "order-1", [
      "confirmed" as never,
      "processing" as never,
    ]);

    expect(result).toEqual({
      fromStatus: "pending",
      toStatus: "processing",
      stepsApplied: ["confirmed", "processing"],
    });

    const history = fake.inserts.order_status_history;
    expect(history).toHaveLength(2);
    expect(history[0]).toMatchObject({
      order_id: "order-1",
      previous_status: "pending",
      new_status: "confirmed",
      created_by: "admin-1",
    });
    expect(history[1]).toMatchObject({
      order_id: "order-1",
      previous_status: "confirmed",
      new_status: "processing",
      created_by: "admin-1",
    });
  });

  it("rejects an empty step list", async () => {
    const fake = makeFakeFrom([]);
    vi.mocked(mockCreateClient).mockResolvedValue(fake as never);

    await expect(advanceOrderStatus(actor, "order-1", [] as never[])).rejects.toThrow(
      "No status steps were provided.",
    );
  });

  it("fails the whole chain if a step cannot be applied (does not fake success)", async () => {
    // The concurrent-guard read for the second step returns nothing.
    const fake = makeFakeFrom([
      { data: { status: "confirmed" } as unknown, error: null },
      { data: null, error: { message: "not found" } },
    ]);
    vi.mocked(mockCreateClient).mockResolvedValue(fake as never);
    const before = fake.inserts.order_status_history.length;

    await expect(
      advanceOrderStatus(actor, "order-1", ["processing" as never]),
    ).rejects.toBeInstanceOf(ServiceError);

    // No extra history rows were written for a step that never applied.
    expect(fake.inserts.order_status_history).toHaveLength(before);
  });

  it("verifies the final DB state before reporting success", async () => {
    // Verification read disagrees with the claimed final status.
    const fake = makeFakeFrom([
      { data: { status: "pending" }, error: null },
      { data: { status: "confirmed" }, error: null },
      { data: { status: "processing" }, error: null },
      { data: { status: "confirmed" }, error: null }, // verify mismatch
    ]);
    vi.mocked(mockCreateClient).mockResolvedValue(fake as never);

    await expect(
      advanceOrderStatus(actor, "order-1", [
        "confirmed" as never,
        "processing" as never,
      ]),
    ).rejects.toMatchObject({
      name: "ServiceError",
      message: expect.stringContaining("could not be verified"),
    });
  });
});
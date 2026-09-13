import { describe, expect, it, vi } from "vitest";

import {
  ok,
  fail,
  denied,
  notFound,
  asResult,
  type ToolResult,
} from "@/tools/shared/result";
import { ServiceError } from "@/services/base";

/**
 * Tool result utility tests.
 *
 * These verify the structured result wrapper that every AI tool returns.
 * The wrapper guarantees clients and agents always receive a predictable
 * shape: `{ ok: true, data }` or `{ ok: false, reason, message }`.
 */

describe("ok()", () => {
  it("wraps data in an ok result", () => {
    const result = ok({ id: "1", name: "Test" });
    expect(result).toEqual({ ok: true, data: { id: "1", name: "Test" } });
  });

  it("wraps null data", () => {
    const result = ok(null);
    expect(result).toEqual({ ok: true, data: null });
  });

  it("wraps primitive data", () => {
    expect(ok(42)).toEqual({ ok: true, data: 42 });
    expect(ok("text")).toEqual({ ok: true, data: "text" });
  });
});

describe("fail()", () => {
  it("creates a forbidden result", () => {
    const result = fail("forbidden", "No access");
    expect(result).toEqual({
      ok: false,
      reason: "forbidden",
      message: "No access",
    });
  });

  it("creates a not_found result", () => {
    const result = fail("not_found", "Missing");
    expect(result).toEqual({
      ok: false,
      reason: "not_found",
      message: "Missing",
    });
  });

  it("creates an error result", () => {
    const result = fail("error", "Something broke");
    expect(result).toEqual({
      ok: false,
      reason: "error",
      message: "Something broke",
    });
  });
});

describe("denied()", () => {
  it("creates a forbidden result with the given message", () => {
    const result = denied("Admin access required");
    expect(result).toEqual({
      ok: false,
      reason: "forbidden",
      message: "Admin access required",
    });
  });
});

describe("notFound()", () => {
  it("creates a not_found result with the given message", () => {
    const result = notFound("Product not found");
    expect(result).toEqual({
      ok: false,
      reason: "not_found",
      message: "Product not found",
    });
  });
});

describe("asResult()", () => {
  it("wraps a successful async function", async () => {
    const result = await asResult(async () => ({ x: 1 }));
    expect(result).toEqual({ ok: true, data: { x: 1 } });
  });

  it("wraps a ServiceError into an error result", async () => {
    const result = await asResult(async () => {
      throw new ServiceError("TEST_ERROR", "Test failure");
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("error");
      expect(result.message).toBe("Test failure");
    }
  });

  it("wraps unexpected errors into a safe error result", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await asResult(async () => {
      throw new Error("unexpected");
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("error");
      expect(result.message).toContain("unexpected error");
    }
    consoleSpy.mockRestore();
  });

  it("does not leak internal error details", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await asResult(async () => {
      throw new Error("DATABASE_CONNECTION_SECRET=xyz");
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).not.toContain("DATABASE_CONNECTION_SECRET");
    }
    consoleSpy.mockRestore();
  });
});

describe("ToolResult type consistency", () => {
  it("ok results always have ok: true", () => {
    const results: ToolResult[] = [ok(1), ok("a"), ok(null)];
    for (const r of results) {
      expect(r.ok).toBe(true);
    }
  });

  it("fail results always have ok: false", () => {
    const results: ToolResult[] = [
      fail("forbidden", "x"),
      fail("not_found", "x"),
      fail("error", "x"),
      denied("x"),
      notFound("x"),
    ];
    for (const r of results) {
      expect(r.ok).toBe(false);
    }
  });
});

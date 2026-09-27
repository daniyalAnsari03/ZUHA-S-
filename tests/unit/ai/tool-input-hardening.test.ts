import { describe, expect, it } from "vitest";

import {
  normalizeString,
  requireString,
  ok,
  fail,
  denied,
  notFound,
  invalid,
  type ToolResult,
} from "@/tools/shared/result";

/**
 * Tool input hardening tests.
 *
 * Verify that all tool inputs are safely normalized before reaching
 * Zod validation, and that raw validation errors never leak to users.
 */

describe("normalizeString()", () => {
  it("trims whitespace from strings", () => {
    expect(normalizeString("  hello  ")).toBe("hello");
  });

  it("returns undefined for null", () => {
    expect(normalizeString(null)).toBeUndefined();
  });

  it("returns undefined for undefined", () => {
    expect(normalizeString(undefined)).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(normalizeString("")).toBeUndefined();
  });

  it("returns undefined for whitespace-only string", () => {
    expect(normalizeString("   ")).toBeUndefined();
  });

  it("returns undefined for tabs and newlines", () => {
    expect(normalizeString("\t\n  \n\t")).toBeUndefined();
  });

  it("preserves meaningful strings", () => {
    expect(normalizeString("Jamawar")).toBe("Jamawar");
    expect(normalizeString("embroidery")).toBe("embroidery");
    expect(normalizeString("SKU-123")).toBe("SKU-123");
  });

  it("handles Unicode whitespace", () => {
    expect(normalizeString("\u00A0hello\u00A0")).toBe("hello");
  });
});

describe("requireString()", () => {
  it("returns ok with normalized value for valid strings", () => {
    const result = requireString("  hello  ", "name");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe("hello");
    }
  });

  it("returns invalid result for empty string", () => {
    const result = requireString("", "name");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.result.ok).toBe(false);
      if (!result.result.ok) {
        expect(result.result.reason).toBe("invalid");
        expect(result.result.message).toContain("name");
      }
    }
  });

  it("returns invalid result for null", () => {
    const result = requireString(null, "slug");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.result.ok).toBe(false);
    }
  });

  it("returns invalid result for whitespace-only", () => {
    const result = requireString("   ", "category");
    expect(result.ok).toBe(false);
  });
});

describe("ToolResult type safety", () => {
  it("ok results have data property", () => {
    const result = ok({ id: "1" });
    expect(result).toHaveProperty("data");
    expect(result.ok).toBe(true);
  });

  it("fail results have reason and message", () => {
    const result = fail("error", "something broke");
    expect(result).toHaveProperty("reason");
    expect(result).toHaveProperty("message");
    expect(result.ok).toBe(false);
  });

  it("invalid results have reason 'invalid'", () => {
    const result = invalid("bad input");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("invalid");
    }
  });

  it("denied results have reason 'forbidden'", () => {
    const result = denied("no access");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("forbidden");
    }
  });

  it("notFound results have reason 'not_found'", () => {
    const result = notFound("missing");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("not_found");
    }
  });

  it("ok results can carry optional message", () => {
    const result: ToolResult<string> = ok("data");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBe("data");
    }
  });
});

describe("Zod error prevention", () => {
  it("normalizeString prevents empty string from reaching Zod min(1)", () => {
    const value = normalizeString("");
    // If value is undefined, the tool should handle it before Zod validation
    expect(value).toBeUndefined();
  });

  it("normalizeString prevents whitespace from reaching Zod min(1)", () => {
    const value = normalizeString("   ");
    expect(value).toBeUndefined();
  });

  it("requireString returns structured error for empty input", () => {
    const result = requireString("", "search term");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // This should be a structured ToolResult, not a Zod error
      expect(result.result).toHaveProperty("ok", false);
      expect(result.result).toHaveProperty("reason", "invalid");
      expect(result.result).toHaveProperty("message");
      if (!result.result.ok) {
        expect(result.result.message).not.toContain("Too small");
        expect(result.result.message).not.toContain("expected string");
      }
    }
  });
});

describe("Catalog tool input normalization patterns", () => {
  it("search terms are trimmed before use", () => {
    const search = "  embroidery  ";
    const normalized = normalizeString(search);
    expect(normalized).toBe("embroidery");
  });

  it("category slugs are trimmed before use", () => {
    const slug = "  jamawar  ";
    const normalized = normalizeString(slug);
    expect(normalized).toBe("jamawar");
  });

  it("product IDs are trimmed before use", () => {
    const id = "  550e8400-e29b-41d4-a716-446655440000  ";
    const normalized = normalizeString(id);
    expect(normalized).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("misspelled search terms are preserved for fuzzy matching", () => {
    const search = "emdbroidry";
    const normalized = normalizeString(search);
    expect(normalized).toBe("emdbroidry");
    // ILIKE will handle the fuzzy matching
  });

  it("mixed case search terms are preserved", () => {
    const search = "EmbroiDery";
    const normalized = normalizeString(search);
    expect(normalized).toBe("EmbroiDery");
    // ILIKE is case-insensitive
  });
});

describe("Error message quality", () => {
  it("invalid input error is user-friendly", () => {
    const result = invalid(
      "Please provide a valid product ID to check availability.",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).not.toContain("Zod");
      expect(result.message).not.toContain("TypeError");
      expect(result.message).not.toContain("at ");
      expect(result.message).toContain("Please");
    }
  });

  it("denied error is user-friendly", () => {
    const result = denied(
      "This action requires an admin. You don't have permission for it.",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).not.toContain("stack");
      expect(result.message).not.toContain("Error");
    }
  });

  it("notFound error is user-friendly", () => {
    const result = notFound(
      "No product found. Try searching by name or category.",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).not.toContain("null");
      expect(result.message).not.toContain("undefined");
    }
  });
});

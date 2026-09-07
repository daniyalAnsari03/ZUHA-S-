import { z } from "zod";
import { describe, expect, it } from "vitest";

import { formatZodError, validate } from "@/lib/validation/validate";

describe("validate", () => {
  const schema = z.object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Invalid email"),
  });

  it("returns data for valid input", () => {
    const result = validate(schema, { name: "Daniyal", email: "a@b.com" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Daniyal");
    }
  });

  it("returns an error string for invalid input", () => {
    const result = validate(schema, { name: "", email: "nope" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeTruthy();
    }
  });
});

describe("formatZodError", () => {
  it("returns a human-readable first message", () => {
    const schema = z.object({ email: z.string().email("Invalid email") });
    const { error } = schema.safeParse({ email: "bad" });
    expect(formatZodError(error!)).toBe("Invalid email");
  });
});

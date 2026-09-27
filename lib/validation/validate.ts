import { ZodError, type ZodSchema } from "zod";

export type ValidationResult<T> =
  { success: true; data: T } | { success: false; error: string };

/**
 * Parse untrusted input against a Zod schema, returning a discriminated
 * result so callers never operate on unvalidated data.
 */
export function validate<T>(
  schema: ZodSchema<T>,
  input: unknown,
): ValidationResult<T> {
  const result = schema.safeParse(input);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return { success: false, error: formatZodError(result.error) };
}

/**
 * Return the first human-readable validation message from a Zod error,
 * without leaking internal schema details.
 */
export function formatZodError(error: ZodError): string {
  const first = error.issues[0];
  if (!first) {
    return "Invalid input.";
  }
  return first.message;
}

/** True if the value is a non-empty trimmed string. */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

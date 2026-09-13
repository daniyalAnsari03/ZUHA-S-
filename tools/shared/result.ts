import { ServiceError } from "@/services/base";

export type ToolFailureReason =
  | "forbidden"
  | "not_found"
  | "invalid"
  | "error";

export type ToolResult<T = unknown> =
  | { ok: true; data: T; message?: string }
  | { ok: false; reason: ToolFailureReason; message: string };

export function ok<T>(data: T): ToolResult<T> {
  return { ok: true, data };
}

export function fail<T = never>(
  reason: ToolFailureReason,
  message: string,
): ToolResult<T> {
  return { ok: false, reason, message };
}

export function denied<T = never>(message: string): ToolResult<T> {
  return fail("forbidden", message);
}

export function notFound<T = never>(message: string): ToolResult<T> {
  return fail("not_found", message);
}

export function invalid<T = never>(message: string): ToolResult<T> {
  return fail("invalid", message);
}

/**
 * Wraps a service call, converting expected service failures and unexpected
 * exceptions into a structured ToolResult. Tools must never leak stack traces
 * or internal detail into chat output.
 */
export async function asResult<T>(
  fn: () => Promise<T>,
): Promise<ToolResult<T>> {
  try {
    return ok(await fn());
  } catch (error) {
    if (error instanceof ServiceError) {
      return fail("error", error.message);
    }
    console.error("[ai-tool] unexpected service error:", error);
    return fail(
      "error",
      "An unexpected error occurred while completing this action. No changes were made.",
    );
  }
}

/**
 * Safe string normalization for tool inputs. Trims whitespace, converts
 * empty/whitespace-only strings to undefined. Prevents raw Zod validation
 * errors from reaching the user.
 */
export function normalizeString(
  value: string | null | undefined,
): string | undefined {
  if (value === null || value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Normalize a required string input, returning an invalid ToolResult if
 * the value is empty/missing after normalization.
 */
export function requireString(
  value: string | null | undefined,
  fieldName: string,
): { ok: true; value: string } | { ok: false; result: ToolResult<never> } {
  const normalized = normalizeString(value);
  if (!normalized) {
    return {
      ok: false,
      result: invalid(
        `Please provide a valid ${fieldName}. The value cannot be empty.`,
      ),
    };
  }
  return { ok: true, value: normalized };
}
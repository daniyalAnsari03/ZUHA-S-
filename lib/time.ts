/**
 * Business timezone utilities.
 *
 * The application operates in Pakistan Standard Time (PKT = UTC+5).
 * All "today" / "yesterday" business calculations must use PKT, not the
 * server's local timezone, to ensure consistent results across deployments.
 */

export const BUSINESS_TIMEZONE = "Asia/Karachi" as const;

/**
 * Get a Date object representing "now" in Pakistan Standard Time.
 */
export function nowInPKT(): Date {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: BUSINESS_TIMEZONE }),
  );
}

/**
 * Get today's date key (YYYY-MM-DD) in Pakistan Standard Time.
 */
export function todayKeyPKT(): string {
  return toDateKey(nowInPKT());
}

/**
 * Get yesterday's date key (YYYY-MM-DD) in Pakistan Standard Time.
 */
export function yesterdayKeyPKT(): string {
  const d = nowInPKT();
  d.setDate(d.getDate() - 1);
  return toDateKey(d);
}

/**
 * Convert a Date to a YYYY-MM-DD key string.
 */
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Get the PKT date key for N days ago.
 */
export function daysAgoKeyPKT(days: number): string {
  const d = nowInPKT();
  d.setDate(d.getDate() - days);
  return toDateKey(d);
}

/**
 * Human-readable PKT date for the AI context (e.g. "Saturday, 12 September
 * 2026"). Built from the same PKT wall-clock the rest of the business uses so
 * the AI never has to guess "today".
 */
export function formatPKTDate(): string {
  return nowInPKT().toLocaleDateString("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

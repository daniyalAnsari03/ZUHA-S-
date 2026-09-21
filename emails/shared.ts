/**
 * Shared constants and helpers for the premium DINS report emails.
 *
 * Written as plain React Email components (no Tailwind) so the emails render
 * reliably across email clients. The visual language is the locked brand
 * palette: ivory/cream backgrounds, warm wine-plum accents, dark charcoal text.
 */

export const BRAND_NAME = "DINS by Daniyal";

export const BRAND_COLORS = {
  plum: "#4a2040",
  plumDark: "#3a1833",
  plumLight: "#7a3570",
  ivory: "#f6f1e7",
  cream: "#faf7f0",
  charcoal: "#1f1a22",
  muted: "#8a7f88",
  white: "#ffffff",
  border: "#e8e0d3",
} as const;

export function formatPrice(value: number): string {
  return `PKR ${new Intl.NumberFormat("en-PK").format(Math.round(value))}`;
}
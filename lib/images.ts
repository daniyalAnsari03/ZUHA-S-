const STORAGE_BUCKET = "product-images";

/**
 * Resolve a stored image reference into a renderable URL for `next/image`.
 *
 * Handles:
 *  - absolute http/https URLs → used as-is
 *  - local public paths starting with "/" → used as-is
 *  - Supabase Storage paths like "cms/hero/file.jpeg" → converted to public URL
 *  - empty string / null / undefined → returns null
 */
export function resolveImageUrl(
  src: string | null | undefined,
): string | null {
  if (!src || typeof src !== "string") return null;

  const trimmed = src.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  if (trimmed.startsWith("/")) {
    return trimmed;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  if (!supabaseUrl) return null;

  return `${supabaseUrl}/storage/v1/object/public/${STORAGE_BUCKET}/${trimmed}`;
}

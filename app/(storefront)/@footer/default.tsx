import { Footer } from "@/components/storefront/footer";
import { getActiveCategories } from "@/lib/storefront/data";

/**
 * The footer every storefront route inherits.
 *
 * This is the slot's fallback, so it applies to `/shop`, `/cart`, `/checkout`,
 * `/account`, product pages and everything else nested under `app/(storefront)`.
 * The homepage overrides it with `page.tsx`, which returns null because the
 * homepage renders the footer inside the slide stack instead.
 *
 * The footer is untouched here — same links, same order, same layout. Only
 * where it is *placed* differs between the homepage and every other page.
 */
export default async function DefaultFooterSlot() {
  const categories = await getActiveCategories();
  return <Footer categories={categories} />;
}
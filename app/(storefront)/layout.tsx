import type { ReactNode } from "react";

import { AnnouncementBar } from "@/components/storefront/announcement-bar";
import { AiSalesmanWidget } from "@/components/chat/ai-salesman-widget";
import { Navbar } from "@/components/storefront/navbar";
import {
  getActiveAnnouncements,
  getActiveCategories,
  getAllActiveProducts,
} from "@/lib/storefront/data";
import { WidgetErrorBoundary } from "@/components/ui/widget-error-boundary";

/**
 * Storefront chrome layout.
 *
 * Renders the announcement bar, navbar and footer for every storefront route
 * (`(storefront)` route group). Auth routes such as `/login` live outside this
 * group so they get the raw ivory page without the storefront chrome.
 *
 * The footer arrives through the `@footer` parallel slot rather than being
 * rendered here directly. The slot is what lets the homepage put the footer
 * INSIDE its full-screen slide stack — as the closing snap slide — while every
 * other route keeps getting an ordinary footer in the normal document flow. A
 * layout cannot tell which route it is rendering, so the decision has to be
 * made one level down; `app/(storefront)/@footer/page.tsx` answers null for the
 * homepage and `default.tsx` answers the real footer for everything nested.
 */
export default async function StorefrontLayout({
  children,
  footer,
}: {
  children: ReactNode;
  footer: ReactNode;
}) {
  const [categories, products, announcements] = await Promise.all([
    getActiveCategories(),
    getAllActiveProducts(),
    getActiveAnnouncements(),
  ]);

  return (
    <>
      <AnnouncementBar announcements={announcements} />
      <Navbar categories={categories} products={products} />
      <div className="flex flex-1 flex-col">{children}</div>
      {footer}
      <WidgetErrorBoundary>
        <AiSalesmanWidget />
      </WidgetErrorBoundary>
    </>
  );
}

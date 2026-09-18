import type { ReactNode } from "react";

import { AnnouncementBar } from "@/components/storefront/announcement-bar";
import { AiSalesmanWidget } from "@/components/chat/ai-salesman-widget";
import { Footer } from "@/components/storefront/footer";
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
 */
export default async function StorefrontLayout({
  children,
}: {
  children: ReactNode;
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
      <Footer categories={categories} />
      <WidgetErrorBoundary>
        <AiSalesmanWidget />
      </WidgetErrorBoundary>
    </>
  );
}
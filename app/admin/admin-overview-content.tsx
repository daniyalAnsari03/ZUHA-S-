import { redirect } from "next/navigation";

import { getAuthUser } from "@/lib/auth/session";
import { getAdminDashboard } from "@/services/analytics/analytics-service";

import { AdminOverview, AdminOverviewSkeleton } from "./admin-overview";

/**
 * Streamed admin overview body.
 *
 * This is a separate async server component (rather than more `await`s in
 * `page.tsx`) so React can flush the page shell to the browser immediately and
 * stream this part in behind `<Suspense>`. The dashboard aggregates are the
 * slowest part of the request, and awaiting them inline held the whole
 * response — which is what Lighthouse measured as admin TTFB, and as a >1.5s
 * delay before the LCP element could render.
 *
 * The queries behind `getAdminDashboard` already run in parallel. They are
 * deliberately left uncached so the numbers the owner sees stay live and
 * truthful rather than served from a stale snapshot.
 */
export async function AdminOverviewContent() {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") redirect("/login");

  let dashboard = null;
  try {
    dashboard = await getAdminDashboard({ id: user.id, role: user.role });
  } catch (error) {
    console.error("[admin] dashboard load failed:", error);
  }

  if (!dashboard) {
    return (
      <div className="mt-8 rounded-xl border border-charcoal/10 bg-neutral-soft p-10 text-center text-sm text-charcoal-muted">
        Dashboard could not be loaded right now. Please try again.
      </div>
    );
  }

  return <AdminOverview dashboard={dashboard} email={user.email} />;
}

export { AdminOverviewSkeleton };

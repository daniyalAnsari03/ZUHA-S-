import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Suspense } from "react";

import { AdminOverviewContent, AdminOverviewSkeleton } from "./admin-overview-content";

/**
 * Admin overview shell.
 *
 * Only the heading renders on the critical path; the dashboard aggregates load
 * inside a `<Suspense>` boundary so the response starts immediately instead of
 * waiting for the order/product/customer queries to finish.
 */
export default function AdminOverviewPage() {
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-charcoal">Overview</h1>
          <p className="mt-1 text-sm text-charcoal-muted">
            Business snapshot for the current admin account.
          </p>
        </div>
        <Link
          href="/admin/analytics"
          className="inline-flex items-center gap-1.5 rounded-full bg-plum px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-plum-dark"
        >
          Sales analytics
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      <Suspense fallback={<AdminOverviewSkeleton />}>
        <AdminOverviewContent />
      </Suspense>
    </div>
  );
}

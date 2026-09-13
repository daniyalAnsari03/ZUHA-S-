import type { ReactNode } from "react";
import Link from "next/link";
import { LockKeyhole } from "lucide-react";

import { AdminShell } from "@/app/admin/admin-shell";
import { Container } from "@/components/ui/container";
import { getAuthUser } from "@/lib/auth/session";
import { getUnreadCount } from "@/services/notifications/notification-service";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getAuthUser();

  if (!user || user.role !== "admin") {
    return (
      <main className="flex flex-1 items-center justify-center bg-ivory px-6 py-24">
        <Container size="sm" className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-plum/10">
            <LockKeyhole className="h-6 w-6 text-plum" aria-hidden="true" />
          </div>
          <h1 className="mt-6 font-serif text-2xl text-charcoal">
            {user ? "Admins only" : "Sign in required"}
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-charcoal-muted">
            {user
              ? "Your account does not have permission to open the business control center."
              : "Please sign in with an admin account to open the business control center."}
          </p>
          <Link
            href="/"
            className="mt-8 inline-block rounded-full bg-plum px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-plum-dark"
          >
            Back to the storefront
          </Link>
        </Container>
      </main>
    );
  }

  const unreadCount = await getUnreadCount(user.id).catch(() => 0);

  return (
    <AdminShell userEmail={user.email} unreadCount={unreadCount}>
      {children}
    </AdminShell>
  );
}
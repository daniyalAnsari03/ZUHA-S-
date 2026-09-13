import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LayoutDashboard } from "lucide-react";

import { Container } from "@/components/ui/container";
import { getAuthUser } from "@/lib/auth/session";
import { getWishlistSummaryIfExists } from "@/services/wishlist/wishlist-service";
import { getOwnProfile } from "@/services/profiles/get-own-profile";
import { ProfileEditor } from "./profile-editor";

export const metadata: Metadata = {
  title: "My Account",
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const [wishlist, profile] = await Promise.all([
    getWishlistSummaryIfExists(user.id).catch(() => null),
    getOwnProfile(user.id).catch(() => null),
  ]);

  const wishlistItemCount = wishlist?.itemCount ?? 0;

  return (
    <main className="flex-1 bg-ivory">
      <Container size="lg" className="py-10 sm:py-14">
        <p className="text-[11px] uppercase tracking-[0.32em] text-gold-muted">
          <Link href="/" className="transition-colors hover:text-plum">
            Home
          </Link>{" "}
          / My Account
        </p>

        <h1 className="mt-3 font-serif text-2xl text-charcoal sm:text-3xl">
          My Account
        </h1>

        <div className="mt-8 grid gap-8 lg:grid-cols-3">
          <section className="lg:col-span-2 space-y-6">
            {/* Profile editor */}
            <ProfileEditor
              email={user.email ?? "—"}
              role={user.role}
              profile={{
                full_name: profile?.full_name ?? null,
                phone: profile?.phone ?? null,
                address: profile?.address ?? null,
                city: profile?.city ?? null,
                postal_code: profile?.postal_code ?? null,
              }}
            />

            {user.role === "admin" ? (
              <nav aria-label="Admin actions" className="space-y-3">
                <Link
                  href="/admin"
                  className="flex items-center justify-between rounded-lg border border-plum/20 bg-plum/5 px-5 py-4 text-sm font-medium text-plum transition-colors hover:border-plum hover:bg-plum/10"
                >
                  <span className="flex items-center gap-2">
                    <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                    Admin Dashboard
                  </span>
                  <span aria-hidden="true">→</span>
                </Link>
                <Link
                  href="/shop"
                  className="flex items-center justify-between rounded-lg border border-charcoal/10 bg-white px-5 py-4 text-sm font-medium text-charcoal transition-colors hover:border-plum hover:text-plum"
                >
                  <span>Continue Shopping</span>
                  <span aria-hidden="true">→</span>
                </Link>
                <Link
                  href="/wishlist"
                  className="flex items-center justify-between rounded-lg border border-charcoal/10 bg-white px-5 py-4 text-sm font-medium text-charcoal transition-colors hover:border-plum hover:text-plum"
                >
                  <span>Wishlist ({wishlistItemCount} saved)</span>
                  <span aria-hidden="true">→</span>
                </Link>
              </nav>
            ) : (
              <nav aria-label="Account actions" className="space-y-3">
                <Link
                  href="/shop"
                  className="flex items-center justify-between rounded-lg border border-charcoal/10 bg-white px-5 py-4 text-sm font-medium text-charcoal transition-colors hover:border-plum hover:text-plum"
                >
                  <span>Continue Shopping</span>
                  <span aria-hidden="true">→</span>
                </Link>
                <Link
                  href="/orders"
                  className="flex items-center justify-between rounded-lg border border-charcoal/10 bg-white px-5 py-4 text-sm font-medium text-charcoal transition-colors hover:border-plum hover:text-plum"
                >
                  <span>My Orders</span>
                  <span aria-hidden="true">→</span>
                </Link>
                <Link
                  href="/wishlist"
                  className="flex items-center justify-between rounded-lg border border-charcoal/10 bg-white px-5 py-4 text-sm font-medium text-charcoal transition-colors hover:border-plum hover:text-plum"
                >
                  <span>Wishlist ({wishlistItemCount} saved)</span>
                  <span aria-hidden="true">→</span>
                </Link>
              </nav>
            )}
          </section>

          <aside className="space-y-6">
            <article className="rounded-xl border border-charcoal/10 bg-white p-6 sm:p-8">
              <h2 className="font-serif text-lg text-charcoal">Quick Actions</h2>
              <div className="mt-4 space-y-3">
                <Link
                  href="/shop"
                  className="flex items-center justify-between w-full rounded-lg border border-charcoal/15 bg-transparent px-4 py-3 text-sm font-medium text-charcoal transition-colors hover:border-plum hover:text-plum"
                >
                  <span>Browse Collection</span>
                </Link>
                <Link
                  href="/#section-new-arrivals"
                  className="flex items-center justify-between w-full rounded-lg border border-charcoal/15 bg-transparent px-4 py-3 text-sm font-medium text-charcoal transition-colors hover:border-plum hover:text-plum"
                >
                  <span>New Arrivals</span>
                </Link>
              </div>
            </article>

            <form
              action={async () => {
                "use server";
                const { createClient } = await import("@/lib/supabase/server");
                const supabase = await createClient();
                await supabase.auth.signOut();
              }}
              className="rounded-xl border border-charcoal/10 bg-white p-6 sm:p-8"
            >
              <h2 className="font-serif text-lg text-charcoal">Session</h2>
              <button
                type="submit"
                className="mt-4 w-full rounded-lg border border-red-300 bg-transparent px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
              >
                Sign Out
              </button>
            </form>
          </aside>
        </div>
      </Container>
    </main>
  );
}

import type { ReactNode } from "react";
import Link from "next/link";
import { LayoutDashboard, LockKeyhole, Package, Tags } from "lucide-react";

import { Container } from "@/components/ui/container";
import { getAuthUser } from "@/lib/auth/session";

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

  const navItems = [
    { href: "/admin", label: "Overview", icon: LayoutDashboard },
    { href: "/admin/products", label: "Products", icon: Package },
    { href: "/admin/categories", label: "Categories", icon: Tags },
  ];

  return (
    <div className="min-h-screen bg-ivory">
      <header className="border-b border-charcoal/10 bg-white">
        <Container size="lg" className="flex h-16 items-center justify-between">
          <Link
            href="/admin"
            className="font-serif text-lg text-charcoal transition-colors hover:text-plum"
          >
            dINS by Daniyal <span className="text-plum">· Admin</span>
          </Link>
          <Link
            href="/"
            className="text-xs font-medium uppercase tracking-wide text-charcoal-muted transition-colors hover:text-plum"
          >
            View storefront
          </Link>
        </Container>
      </header>

      <nav
        aria-label="Admin"
        className="border-b border-charcoal/10 bg-white/70 backdrop-blur"
      >
        <Container size="lg" className="flex gap-1 overflow-x-auto">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="inline-flex shrink-0 items-center gap-2 border-b-2 border-transparent px-3 py-3 text-sm font-medium text-charcoal-muted transition-colors hover:text-plum"
            >
              <item.icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </Link>
          ))}
        </Container>
      </nav>

      <main className="py-8 sm:py-10">
        <Container size="lg">{children}</Container>
      </main>
    </div>
  );
}
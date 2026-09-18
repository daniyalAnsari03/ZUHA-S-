"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bell,
  Boxes,
  BrainCircuit,
  ExternalLink,
  Globe2,
  Image,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Plug,
  Package,
  ShoppingBag,
  Tags,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";

import { adminSignOutAction } from "@/app/admin/actions";
import { AdminNotificationBell } from "@/app/admin/components/admin-notification-bell";

type AdminShellProps = {
  userEmail: string | null;
  unreadCount: number;
  children: React.ReactNode;
};

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
};

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Store",
    items: [
      { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
      { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
      { href: "/admin/customers", label: "Customers", icon: Users },
    ],
  },
  {
    title: "Catalog",
    items: [
      { href: "/admin/products", label: "Products", icon: Package },
      { href: "/admin/categories", label: "Categories", icon: Tags },
      { href: "/admin/inventory", label: "Inventory", icon: Boxes },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/admin/notifications", label: "Notifications", icon: Bell },
      { href: "/admin/integrations", label: "Integrations", icon: Plug },
      { href: "/admin/ai", label: "AI Workplace", icon: BrainCircuit },
    ],
  },
  {
    title: "Website",
    items: [
      { href: "/admin/homepage", label: "Homepage", icon: Globe2 },
      { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
      { href: "/admin/media", label: "Media Library", icon: Image },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5" aria-label="Admin navigation">
      {NAV_GROUPS.map((group) => (
        <div key={group.title}>
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-charcoal-muted/70">
            {group.title}
          </p>
          <ul className="space-y-1">
            {group.items.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "bg-plum text-white"
                        : "text-charcoal-muted hover:bg-cream hover:text-plum"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function SidebarFooter({ userEmail }: { userEmail: string | null }) {
  return (
    <div className="border-t border-charcoal/10 px-3 py-4">
      <Link
        href="/"
        target="_blank"
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-charcoal-muted transition-colors hover:bg-cream hover:text-plum"
      >
        <ExternalLink className="h-4 w-4" aria-hidden="true" />
        View storefront
      </Link>
      <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-cream/60 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-charcoal">{userEmail ?? "Admin"}</p>
          <p className="text-[11px] text-charcoal-muted">Administrator</p>
        </div>
        <form action={adminSignOutAction}>
          <button
            type="submit"
            className="inline-flex items-center gap-1 rounded-md p-1.5 text-charcoal-muted transition-colors hover:bg-white hover:text-plum"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
          </button>
        </form>
      </div>
    </div>
  );
}

export function AdminShell({ userEmail, unreadCount, children }: AdminShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--color-ivory)]">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-charcoal/10 bg-white px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="inline-flex items-center justify-center rounded-lg p-2 text-charcoal transition-colors hover:bg-cream"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
        <Link href="/admin" className="font-serif text-lg font-semibold text-plum">
          DINS Admin
        </Link>
        <AdminNotificationBell unreadCount={unreadCount} />
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-charcoal/10 px-4 py-3">
              <span className="font-serif text-lg font-semibold text-plum">DINS Admin</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="inline-flex items-center justify-center rounded-lg p-2 text-charcoal transition-colors hover:bg-cream"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <NavLinks pathname={pathname} onNavigate={() => setMobileOpen(false)} />
            <SidebarFooter userEmail={userEmail} />
          </div>
        </div>
      )}

      {/* Desktop layout */}
      <div className="mx-auto flex max-w-none">
        {/* Sidebar */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-charcoal/10 bg-white lg:flex">
          <div className="flex h-16 items-center border-b border-charcoal/10 px-5">
            <Link href="/admin" className="font-serif text-xl font-semibold text-plum">
              DINS Admin
            </Link>
          </div>
          <NavLinks pathname={pathname} />
          <SidebarFooter userEmail={userEmail} />
        </aside>

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top bar (desktop) */}
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-charcoal/10 bg-white/90 px-6 backdrop-blur lg:px-8">
            <div className="text-sm text-charcoal-muted">
              {/* Breadcrumb area — pages render their own headings below */}
            </div>
            <div className="flex items-center gap-1">
              <AdminNotificationBell unreadCount={unreadCount} />
            </div>
          </header>
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-6xl">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
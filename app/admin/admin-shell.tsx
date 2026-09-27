"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bell,
  Boxes,
  BrainCircuit,
  ChevronDown,
  ExternalLink,
  Globe2,
  Image,
  LayoutDashboard,
  LogOut,
  Mail,
  Megaphone,
  Menu,
  Package,
  ShoppingBag,
  Tags,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

import { AdminNotificationBell } from "@/app/admin/components/admin-notification-bell";
import { signOutClient } from "@/lib/auth/client-signout";

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
      { href: "/admin/reports", label: "Email Reports", icon: Mail },
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

function DinsLogo({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`block h-10 w-[112px] ${className}`}
      style={{
        backgroundImage: "linear-gradient(135deg, #ffffff 0%, #ffffff 100%)",
        WebkitMaskImage: "url('/images/brand/dins-logo-white.png')",
        maskImage: "url('/images/brand/dins-logo-white.png')",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskPosition: "center",
        maskPosition: "center",
      }}
    />
  );
}

function NavLinks({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav
      className="flex-1 space-y-6 overflow-y-auto px-3 py-5"
      aria-label="Admin navigation"
    >
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
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const footer = document.querySelector('[data-admin-footer]');
      if (dropdownOpen && footer && !footer.contains(target)) {
        setDropdownOpen(false);
      }
    }

    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  return (
    <div className="border-t border-charcoal/10 px-3 py-4" data-admin-footer>
      <Link
        href="/"
        target="_blank"
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-charcoal-muted transition-colors hover:bg-cream hover:text-plum"
      >
        <ExternalLink className="h-4 w-4" aria-hidden="true" />
        View storefront
      </Link>
      <div className="relative mt-2">
        <button
          type="button"
          onClick={() => setDropdownOpen((prev) => !prev)}
          className="flex w-full items-center justify-between gap-2 rounded-lg bg-cream/60 px-3 py-2 text-left transition-colors hover:bg-cream"
          aria-label="Account menu"
          aria-expanded={dropdownOpen}
        >
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-charcoal">
              {userEmail ?? "Admin"}
            </p>
            <p className="text-[11px] text-charcoal-muted">Administrator</p>
          </div>
          <ChevronDown
            className={`h-4 w-4 text-charcoal-muted transition-transform ${
              dropdownOpen ? "rotate-180" : ""
            }`}
            aria-hidden="true"
          />
        </button>
        {dropdownOpen && (
          <div
            className="admin-menu-pop absolute bottom-full left-0 right-0 mb-2 z-50 overflow-hidden rounded-xl border border-charcoal/10 bg-white shadow-lg shadow-plum/10 ring-1 ring-charcoal/5"
            role="menu"
            aria-label="Admin account menu"
          >
            <Link
              href="/admin"
              className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-charcoal hover:bg-plum/5 hover:text-plum"
              role="menuitem"
              onClick={() => setDropdownOpen(false)}
            >
              <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
              Dashboard
            </Link>
            <hr className="my-1 border-charcoal/10" />
            <button
              type="button"
              onClick={signOutClient}
              className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50"
              role="menuitem"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sign Out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function AdminShell({
  userEmail,
  unreadCount,
  children,
}: AdminShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--color-ivory)]">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-white/10 bg-plum-dark px-4 shadow-sm lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="inline-flex items-center justify-center rounded-lg p-2 text-white/85 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
        <Link
          href="/admin"
          aria-label="DINS — Admin"
          className="flex items-center"
        >
          <DinsLogo />
        </Link>
        <AdminNotificationBell unreadCount={unreadCount} />
      </header>

      {/* Mobile drawer. The backdrop and panel motion are CSS: the shell is
          hydrated on the first paint of every admin page, and running the
          animation library here was part of why the dashboard's LCP element
          rendered more than a second late on a throttled phone. */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            className="admin-drawer-backdrop absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          />
          <div className="admin-drawer-panel absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-neutral-soft shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 bg-plum-dark px-4 py-3">
              <Link
                href="/admin"
                aria-label="DINS — Admin"
                className="flex items-center py-2"
                onClick={() => setMobileOpen(false)}
              >
                <DinsLogo />
              </Link>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-lg p-2 text-white/85 transition-colors hover:bg-white/10 hover:text-white"
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
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-charcoal/10 bg-neutral-soft lg:flex">
          <div className="flex h-16 items-center border-b border-white/10 bg-plum-dark px-5">
            <Link
              href="/admin"
              aria-label="DINS — Admin"
              className="flex items-center"
            >
              <DinsLogo />
            </Link>
          </div>
          <NavLinks pathname={pathname} />
          <SidebarFooter userEmail={userEmail} />
        </aside>

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top bar (desktop only) */}
          <header className="sticky top-0 z-30 hidden h-16 items-center justify-between border-b border-white/10 bg-plum-dark/95 px-6 shadow-sm backdrop-blur lg:flex lg:px-8">
            <div className="text-sm text-white/70">
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

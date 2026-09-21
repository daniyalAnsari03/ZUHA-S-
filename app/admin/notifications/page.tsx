import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell, BellOff } from "lucide-react";

import {
  markAdminAllNotificationsReadAction,
  markAdminNotificationReadAction,
} from "@/app/admin/actions";
import { getAuthUser } from "@/lib/auth/session";
import { listNotifications } from "@/services/notifications/notification-service";

export const metadata: Metadata = {
  title: "Notifications · Admin",
  robots: { index: false, follow: false },
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}

export default async function AdminNotificationsPage() {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") redirect("/login");

  let notifications: Awaited<ReturnType<typeof listNotifications>> = [];
  let errorShown = false;
  try {
    notifications = await listNotifications(user.id, { limit: 100 });
  } catch (error) {
    errorShown = true;
    console.error("[admin] notifications load failed:", error);
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-charcoal">Notifications</h1>
          <p className="mt-1 text-sm text-charcoal-muted">
            {unreadCount} unread{" "}
            {notifications.length > 0
              ? `· ${notifications.length} total`
              : ""}
          </p>
        </div>
        {unreadCount > 0 && (
          <form action={markAdminAllNotificationsReadAction}>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-full border border-charcoal/15 bg-neutral-soft px-4 py-2 text-sm font-medium text-charcoal transition-colors hover:border-plum hover:text-plum"
            >
              <BellOff className="h-4 w-4" aria-hidden="true" />
              Mark all as read
            </button>
          </form>
        )}
      </div>

      {errorShown ? (
        <div className="mt-8 rounded-xl border border-charcoal/10 bg-neutral-soft p-10 text-center text-sm text-charcoal-muted">
          Notifications could not be loaded right now.
        </div>
      ) : notifications.length === 0 ? (
        <div className="mt-8 rounded-xl border border-charcoal/10 bg-neutral-soft p-10 text-center">
          <Bell className="mx-auto h-10 w-10 text-charcoal-muted/40" aria-hidden="true" />
          <p className="mt-3 text-sm text-charcoal-muted">
            No notifications yet. New orders and low-stock alerts will appear
            here.
          </p>
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-charcoal/5 overflow-hidden rounded-xl border border-charcoal/10 bg-neutral-soft">
          {notifications.map((n) => (
            <li
              key={n.id}
              className={`flex items-start gap-4 px-5 py-4 ${
                !n.is_read ? "bg-plum/3" : ""
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {!n.is_read && (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-plum" />
                  )}
                  <p className="text-sm font-medium text-charcoal">{n.title}</p>
                  <span className="text-xs text-charcoal-muted">
                    {timeAgo(n.created_at)}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-charcoal-muted">{n.message}</p>
                {n.order_id && (
                  <Link
                    href={`/admin/orders/${n.order_id}`}
                    className="mt-1.5 inline-block text-xs font-medium text-plum hover:text-plum-dark"
                  >
                    View order →
                  </Link>
                )}
              </div>
              {!n.is_read && (
                <form
                  action={markAdminNotificationReadAction.bind(null, n.id)}
                  className="shrink-0"
                >
                  <button
                    type="submit"
                    className="rounded-md border border-charcoal/15 px-2.5 py-1.5 text-xs font-medium text-charcoal-muted transition-colors hover:border-plum hover:text-plum"
                  >
                    Mark read
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
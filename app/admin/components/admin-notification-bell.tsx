"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { getAdminNotificationsAction, markAdminNotificationReadAction } from "@/app/admin/actions";

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  order_id: string | null;
  created_at: string;
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const ICON_TYPES: Record<string, string> = {
  admin_new_order: "New order",
  admin_inventory_alert: "Inventory",
  order_created: "Order",
  order_status_updated: "Order",
};

export function AdminNotificationBell({ unreadCount: initialUnread }: { unreadCount: number }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(initialUnread);
  const loadedRef = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const loadNotifications = useCallback(async () => {
    const result = await getAdminNotificationsAction({ limit: 8 });
    if (result.ok && "notifications" in result) {
      setNotifications(result.notifications);
      setUnreadCount(result.unreadCount);
      loadedRef.current = true;
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      void loadNotifications();
    }, 30000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  useEffect(() => {
    if (!open) return;

    const handleClick = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("mousedown", handleClick);
    };
  }, [open]);

  useEffect(() => {
    if (!open || loadedRef.current) return;
    void loadNotifications();
  }, [open, loadNotifications]);

  const markRead = async (id: string) => {
    await markAdminNotificationReadAction(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
        className={`relative inline-flex items-center justify-center rounded-lg p-2.5 text-charcoal-muted transition-colors hover:bg-cream hover:text-plum ${
          open ? "bg-cream text-plum" : ""
        }`}
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-plum px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full z-50 mt-2 w-96 max-h-[480px] overflow-hidden rounded-xl border border-charcoal/10 bg-neutral-soft shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-charcoal/10 px-4 py-3">
            <h3 className="font-serif text-sm text-charcoal">Admin notifications</h3>
            <Link
              href="/admin/notifications"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-plum hover:text-plum-dark"
            >
              View all
            </Link>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-charcoal-muted">
                No notifications yet.
              </div>
            ) : (
              <ul className="divide-y divide-charcoal/5">
                {notifications.map((n) => (
                  <li
                    key={n.id}
                    className={`px-4 py-3 transition-colors hover:bg-cream/40 ${
                      !n.is_read ? "bg-plum/3" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {!n.is_read && (
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-plum" />
                      )}
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/admin/notifications/${n.id}`}
                          onClick={() => {
                            void markRead(n.id);
                            setOpen(false);
                          }}
                          className="block text-sm font-medium text-charcoal transition-colors hover:text-plum"
                        >
                          {n.title}
                        </Link>
                        <p className="mt-0.5 text-xs text-charcoal-muted line-clamp-2">
                          {n.message}
                        </p>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-[10px] text-charcoal-muted">
                            {timeAgo(n.created_at)}
                          </span>
                          {n.order_id ? (
                            <Link
                              href={`/admin/orders/${n.order_id}`}
                              onClick={() => {
                                void markRead(n.id);
                                setOpen(false);
                              }}
                              className="text-[10px] font-medium text-plum hover:text-plum-dark"
                            >
                              View order
                            </Link>
                          ) : (
                            <span className="text-[10px] font-medium text-plum">
                              {ICON_TYPES[n.type] ?? "Notice"}
                            </span>
                          )}
                        </div>
                      </div>
                      {!n.is_read && (
                        <button
                          type="button"
                          onClick={() => void markRead(n.id)}
                          className="shrink-0 text-[10px] text-charcoal-muted hover:text-plum"
                          aria-label="Mark as read"
                        >
                          ✓
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
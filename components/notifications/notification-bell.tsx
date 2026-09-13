"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { getNotificationsAction, markNotificationReadAction } from "@/app/storefront/actions";

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

export function NotificationBell({ iconButtonClass }: { iconButtonClass: string }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const loadedRef = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const loadNotifications = useCallback(async () => {
    const result = await getNotificationsAction({ limit: 10 });
    if (result.ok) {
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

  const handleToggle = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  const markRead = async (id: string) => {
    await markNotificationReadAction(id);
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
        onClick={handleToggle}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
        className={`relative ${iconButtonClass}`}
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-plum px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full z-50 mt-2 w-80 max-h-96 overflow-hidden rounded-xl border border-charcoal/10 bg-white shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-charcoal/10 px-4 py-3">
            <h3 className="font-serif text-sm text-charcoal">Notifications</h3>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={async () => {
                  const { markAllNotificationsReadAction } = await import("@/app/storefront/actions");
                  await markAllNotificationsReadAction();
                  setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
                  setUnreadCount(0);
                }}
                className="text-xs font-medium text-plum hover:text-plum-dark"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="overflow-y-auto max-h-80">
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
                        <p className="text-sm font-medium text-charcoal">{n.title}</p>
                        <p className="mt-0.5 text-xs text-charcoal-muted line-clamp-2">
                          {n.message}
                        </p>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-[10px] text-charcoal-muted">
                            {timeAgo(n.created_at)}
                          </span>
                          {n.order_id && (
                            <Link
                              href={`/orders/${n.order_id}`}
                              onClick={() => {
                                void markRead(n.id);
                                setOpen(false);
                              }}
                              className="text-[10px] font-medium text-plum hover:text-plum-dark"
                            >
                              View order
                            </Link>
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

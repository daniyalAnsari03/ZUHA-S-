"use client";

import Link from "next/link";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";

import {
  getNotificationsAction,
  markNotificationReadAction,
  markAllNotificationsReadAction,
} from "@/app/storefront/actions";

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

export type ChatNotificationBadgeHandle = {
  close: () => void;
};

type Props = {
  onOpenChange?: (open: boolean) => void;
};

/**
 * Compact unread-notification indicator designed exclusively for the floating
 * storefront chat widget trigger (bottom-right corner). Uses a distinct,
 * non-bell visual treatment: a small plum pill badge showing the unread count
 * that opens a lightweight notification popover when tapped.
 */
export const ChatNotificationBadge = forwardRef<ChatNotificationBadgeHandle, Props>(
  function ChatNotificationBadge({ onOpenChange }, ref) {
    const [open, setOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const loadedRef = useRef(false);
    const panelRef = useRef<HTMLDivElement>(null);
    const badgeRef = useRef<HTMLButtonElement>(null);

    const close = useCallback(() => {
      setOpen(false);
    }, []);

    useImperativeHandle(ref, () => ({ close }), [close]);

    const load = useCallback(async () => {
      const result = await getNotificationsAction({ limit: 10 });
      if (result.ok) {
        setNotifications(result.notifications);
        setUnreadCount(result.unreadCount);
        loadedRef.current = true;
      }
    }, []);

    useEffect(() => {
      void load();
      const id = setInterval(() => void load(), 30000);
      return () => clearInterval(id);
    }, [load]);

    useEffect(() => {
      if (!open) return;
      const handleClick = (e: MouseEvent) => {
        if (
          panelRef.current &&
          !panelRef.current.contains(e.target as Node) &&
          badgeRef.current &&
          !badgeRef.current.contains(e.target as Node)
        ) {
          setOpen(false);
        }
      };
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }, [open]);

    useEffect(() => {
      onOpenChange?.(open);
    }, [open, onOpenChange]);

    if (unreadCount === 0) return null;

    return (
      <div className="relative">
        <motion.button
          ref={badgeRef}
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
          aria-label={`${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`}
          className="absolute -top-1.5 right-0 z-10 flex h-[22px] min-w-[22px] items-center justify-center rounded-full border-[2px] border-white bg-plum px-1 text-[10px] font-bold leading-none text-white shadow-md"
        >
          {unreadCount > 99 ? "99+" : unreadCount}
        </motion.button>

        <AnimatePresence>
          {open && (
            <motion.div
              ref={panelRef}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.18 }}
              className="absolute bottom-[calc(100%+12px)] right-0 z-50 w-80 max-h-96 overflow-hidden rounded-xl border border-charcoal/10 bg-white shadow-xl max-sm:right-0 max-sm:w-[calc(100vw-2rem)]"
            >
              <div className="flex items-center justify-between border-b border-charcoal/10 px-4 py-3">
                <h3 className="font-serif text-sm text-charcoal">
                  Notifications
                </h3>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={async () => {
                      await markAllNotificationsReadAction();
                      setNotifications((prev) =>
                        prev.map((n) => ({ ...n, is_read: true })),
                      );
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
                            <p className="text-sm font-medium text-charcoal">
                              {n.title}
                            </p>
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
                                    void markNotificationReadAction(n.id);
                                    setNotifications((prev) =>
                                      prev.map((m) =>
                                        m.id === n.id
                                          ? { ...m, is_read: true }
                                          : m,
                                      ),
                                    );
                                    setUnreadCount((prev) =>
                                      Math.max(0, prev - 1),
                                    );
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
                              onClick={() => {
                                void markNotificationReadAction(n.id);
                                setNotifications((prev) =>
                                  prev.map((m) =>
                                    m.id === n.id
                                      ? { ...m, is_read: true }
                                      : m,
                                  ),
                                );
                                setUnreadCount((prev) =>
                                  Math.max(0, prev - 1),
                                );
                              }}
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  },
);

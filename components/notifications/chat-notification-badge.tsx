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
 * Persistent notification indicator designed exclusively for the floating
 * storefront chat widget trigger (bottom-right corner). A small bespoke gold
 * bell icon always hovers just above the AI Salesman chat button; an
 * unread-count badge appears on its corner only when there are new
 * notifications. Clicking it opens a lightweight notification popover.
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

    return (
      <div className="relative">
        <motion.button
          ref={badgeRef}
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          initial={{ opacity: 0, y: 6, scale: 0.85 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.2 }}
          aria-label={
            unreadCount > 0
              ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
              : "Notifications"
          }
          className="absolute inset-x-0 bottom-[calc(100%+0.375rem)] z-10 mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-plum text-white shadow-md shadow-plum/25 ring-1 ring-gold-soft/70 transition hover:bg-plum-dark max-[400px]:h-7 max-[400px]:w-7"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            className="h-4 w-4 max-[400px]:h-3.5 max-[400px]:w-3.5"
          >
            <defs>
              <linearGradient
                id="chat-bell-gold"
                x1="6"
                y1="3"
                x2="18"
                y2="22"
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0" stopColor="#d6c39a" />
                <stop offset="0.55" stopColor="#b89b63" />
                <stop offset="1" stopColor="#8f7748" />
              </linearGradient>
            </defs>
            <circle
              cx="12"
              cy="4.5"
              r="1.05"
              stroke="url(#chat-bell-gold)"
              strokeWidth="1.1"
              strokeLinecap="round"
            />
            <path
              d="M12 5.55V7"
              stroke="url(#chat-bell-gold)"
              strokeWidth="1.1"
              strokeLinecap="round"
            />
            <path
              d="M12 7c-2.6 0-4.6 1.9-4.6 4.5 0 2.8.85 5.2.75 6.7-.05.7.55 1.3 1.25 1.3h5.2c.7 0 1.3-.6 1.25-1.3-.1-1.5.75-3.9.75-6.7C16.6 8.9 14.6 7 12 7Z"
              stroke="url(#chat-bell-gold)"
              strokeWidth="1.15"
              strokeLinejoin="round"
              fill="url(#chat-bell-gold)"
              fillOpacity="0.12"
            />
            <path
              d="M8.7 18.25c2.1 1.15 4.5 1.15 6.6 0"
              stroke="url(#chat-bell-gold)"
              strokeWidth="1.1"
              strokeLinecap="round"
              opacity="0.8"
            />
            <path
              d="M12 19.5v0.9"
              stroke="url(#chat-bell-gold)"
              strokeWidth="1.1"
              strokeLinecap="round"
            />
            <circle
              cx="12"
              cy="20.75"
              r="0.65"
              stroke="url(#chat-bell-gold)"
              strokeWidth="1.1"
              fill="url(#chat-bell-gold)"
              fillOpacity="0.25"
            />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full border border-white bg-gold-muted px-0.5 text-[9px] font-bold leading-none text-charcoal">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
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
                            <Link
                              href={`/notifications/${n.id}`}
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

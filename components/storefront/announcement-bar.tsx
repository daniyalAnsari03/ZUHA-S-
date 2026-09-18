"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";

import type { Announcement } from "@/lib/storefront/types";

type AnnouncementBarProps = {
  announcements: Announcement[];
};

const SEPARATOR = "   •   ";

/**
 * Continuous news-style ticker strip. All active announcements scroll
 * right-to-left (like a news headline ticker) in a seamless loop. In Phase 2
 * the messages come from the storefront config; admin-controlled messaging
 * arrives in a later phase.
 */
export function AnnouncementBar({ announcements }: AnnouncementBarProps) {
  const active = useMemo(
    () =>
      announcements
        .filter((a) => a.active)
        .sort((a, b) => a.order - b.order),
    [announcements],
  );

  const content = useMemo(() => {
    const text = active.map((a) => a.message.trim()).join(SEPARATOR);
    return text ? `${text}${SEPARATOR}` : "";
  }, [active]);

  if (!content) return null;

  return (
    <div
      role="region"
      aria-label="Announcements"
      className="relative overflow-hidden bg-plum-dark text-ivory"
    >
      <motion.div
        className="flex whitespace-nowrap will-change-transform"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 35, ease: "linear", repeat: Infinity }}
      >
        <span className="shrink-0 py-2.5 pl-5 text-[9px] font-medium uppercase tracking-[0.2em] sm:text-[10px]">
          {content}
        </span>
        <span className="shrink-0 py-2.5 pl-5 text-[9px] font-medium uppercase tracking-[0.2em] sm:text-[10px]">
          {content}
        </span>
      </motion.div>
    </div>
  );
}
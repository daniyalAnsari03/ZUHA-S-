"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

import type { Announcement } from "@/lib/storefront/types";

type AnnouncementBarProps = {
  announcements: Announcement[];
};

/**
 * Rotating announcement strip. Only ONE message is visible at a time; messages
 * transition smoothly. In Phase 2 the messages come from the storefront
 * config; admin-controlled messaging arrives in a later phase.
 */
export function AnnouncementBar({ announcements }: AnnouncementBarProps) {
  const active = useMemo(
    () =>
      announcements
        .filter((a) => a.active)
        .sort((a, b) => a.order - b.order),
    [announcements],
  );

  const [index, setIndex] = useState(0);

  const count = active.length;
  const current = active[index % count] ?? null;

  useEffect(() => {
    if (count <= 1) return;
    const item = active[index % count];
    if (!item) return;
    const timer = setTimeout(() => {
      setIndex((i) => (i + 1) % count);
    }, item.durationMs);
    return () => clearTimeout(timer);
  }, [index, active, count]);

  if (!current) return null;

  return (
    <div
      role="region"
      aria-label="Announcements"
      className="relative overflow-hidden bg-plum-dark text-ivory"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={current.id}
          className="mx-auto max-w-7xl px-4 py-2.5 text-center text-[11px] font-medium uppercase tracking-[0.2em] sm:text-xs"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          transition={{ duration: 0.35 }}
        >
          {current.message}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
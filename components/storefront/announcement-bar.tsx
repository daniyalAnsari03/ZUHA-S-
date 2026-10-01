"use client";

import { usePathname } from "next/navigation";

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
 *
 * The loop is a plain CSS transform animation. This is a first-viewport
 * element that animates forever, so it deliberately avoids a JS animation
 * runtime, which keeps the animation library out of the critical bundle.
 *
 * The strip carries no background of its own: it is absolutely positioned at
 * the top of the page so the hero photograph runs underneath it. Over the
 * homepage hero the text is white with a soft shadow, and everywhere else it
 * sits on the ivory page in muted charcoal.
 */
export function AnnouncementBar({ announcements }: AnnouncementBarProps) {
  const isHome = usePathname() === "/";

  const active = announcements
    .filter((a) => a.active)
    .sort((a, b) => a.order - b.order);

  const text = active.map((a) => a.message.trim()).join(SEPARATOR);
  const content = text ? `${text}${SEPARATOR}` : "";

  if (!content) return null;

  const tone = isHome ? "text-white" : "text-charcoal-muted";

  return (
    <div
      role="region"
      aria-label="Announcements"
      className="pointer-events-none absolute inset-x-0 top-0 z-50 h-9 overflow-hidden"
    >
      <div className="announcement-ticker flex h-full items-center whitespace-nowrap">
        <span
          className={`shrink-0 pl-5 text-[9px] font-normal uppercase tracking-[0.2em] sm:text-[10px] ${tone}`}
        >
          {content}
        </span>
        <span
          aria-hidden="true"
          className={`shrink-0 pl-5 text-[9px] font-normal uppercase tracking-[0.2em] sm:text-[10px] ${tone}`}
        >
          {content}
        </span>
      </div>
    </div>
  );
}

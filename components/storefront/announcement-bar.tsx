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
 */
export function AnnouncementBar({ announcements }: AnnouncementBarProps) {
  const active = announcements
    .filter((a) => a.active)
    .sort((a, b) => a.order - b.order);

  const text = active.map((a) => a.message.trim()).join(SEPARATOR);
  const content = text ? `${text}${SEPARATOR}` : "";

  if (!content) return null;

  return (
    <div
      role="region"
      aria-label="Announcements"
      className="relative overflow-hidden bg-plum-dark text-ivory"
    >
      <div className="announcement-ticker flex whitespace-nowrap">
        <span className="shrink-0 py-2.5 pl-5 text-[9px] font-medium uppercase tracking-[0.2em] sm:text-[10px]">
          {content}
        </span>
        <span
          aria-hidden="true"
          className="shrink-0 py-2.5 pl-5 text-[9px] font-medium uppercase tracking-[0.2em] sm:text-[10px]">
          {content}
        </span>
      </div>
    </div>
  );
}

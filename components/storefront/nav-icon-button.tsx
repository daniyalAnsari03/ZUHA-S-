"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

export type NavIconEffect = "menu" | "search" | "account" | "bag";
export type NavIconTone = "dark" | "light";

const sheenTone: Record<NavIconTone, string> = {
  dark: "via-white/45",
  light: "via-plum/20",
};

type NavIconProps = {
  label: string;
  icon: ReactNode;
  effect: NavIconEffect;
  tone: NavIconTone;
  className: string;
  delay?: number;
  badge?: ReactNode;
  href?: string;
  onClick?: () => void;
  expanded?: boolean;
};

/**
 * Premium animated navbar icon control. Wraps a chip-styled button or link with
 * layered CSS motion: chip lift/press, a light sheen sweep, and an
 * icon-specific micro-interaction (bag swing, search tilt, account pop, menu
 * rotate).
 *
 * This control sits in the first viewport on every storefront page, so all of
 * its motion is CSS. The previous JS animation library pulled a large runtime
 * into the critical bundle and ran springs on five icons during first paint.
 */
export function NavIcon({
  label,
  icon,
  effect,
  tone,
  className,
  delay = 0,
  badge,
  href,
  onClick,
  expanded,
}: NavIconProps) {
  const style = { "--nav-delay": `${delay}s` } as CSSProperties;
  const classes = `group relative animate-nav-enter ${className}`;

  const content = (
    <>
      <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
        <span
          aria-hidden="true"
          className={`absolute inset-y-0 -left-1/3 w-1/3 skew-x-[-18deg] bg-gradient-to-r from-transparent ${sheenTone[tone]} to-transparent opacity-0 transition-all duration-700 ease-out group-hover:left-[130%] group-hover:opacity-100`}
        />
      </span>
      <span className="nav-icon-glyph relative z-10 inline-flex items-center justify-center">
        {icon}
      </span>
      {badge}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        aria-label={label}
        className={classes}
        style={style}
        data-nav-icon={effect}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-expanded={expanded}
      className={classes}
      style={style}
      data-nav-icon={effect}
    >
      {content}
    </button>
  );
}

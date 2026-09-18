"use client";

import Link from "next/link";
import {
  motion,
  useReducedMotion,
  type Transition,
  type Variants,
} from "framer-motion";
import type { ReactNode } from "react";

export type NavIconEffect = "menu" | "search" | "account" | "bag";
export type NavIconTone = "dark" | "light";

const MotionLink = motion.create(Link);

const spring: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 26,
  mass: 0.7,
};

/** Chip-level motion: lift + scale on hover, crisp press on tap. */
const chipVariants: Variants = {
  rest: { scale: 1, y: 0 },
  hover: { scale: 1.07, y: -2, transition: spring },
  tap: {
    scale: 0.9,
    transition: { type: "spring", stiffness: 650, damping: 28 },
  },
};

/** Per-icon micro-interaction performed on hover. */
const iconVariants: Record<NavIconEffect, Variants> = {
  menu: {
    rest: { rotate: 0 },
    hover: {
      rotate: -90,
      transition: { type: "spring", stiffness: 300, damping: 18 },
    },
  },
  search: {
    rest: { rotate: 0, scale: 1 },
    hover: {
      rotate: -16,
      scale: 1.14,
      transition: { type: "spring", stiffness: 320, damping: 16 },
    },
  },
  account: {
    rest: { y: 0, scale: 1 },
    hover: {
      y: -2,
      scale: 1.14,
      transition: { type: "spring", stiffness: 320, damping: 16 },
    },
  },
  bag: {
    rest: { rotate: 0 },
    hover: {
      rotate: [0, -14, 11, -7, 4, 0],
      transition: { duration: 0.7, ease: "easeInOut" },
    },
  },
};

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
 * layered motion: chip lift/press, a light sheen sweep, and an icon-specific
 * micro-interaction (bag swing, search tilt, account pop, menu rotate). Fully
 * degrades to a static control when the user prefers reduced motion.
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
  const reduceMotion = useReducedMotion();
  const classes = `group relative ${className}`;

  const content = (
    <>
      {reduceMotion ? null : (
        <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
          <span
            aria-hidden="true"
            className={`absolute inset-y-0 -left-1/3 w-1/3 skew-x-[-18deg] bg-gradient-to-r from-transparent ${sheenTone[tone]} to-transparent opacity-0 transition-all duration-700 ease-out group-hover:left-[130%] group-hover:opacity-100`}
          />
        </span>
      )}
      {reduceMotion ? (
        <span className="relative z-10 inline-flex items-center justify-center">
          {icon}
        </span>
      ) : (
        <motion.span
          variants={iconVariants[effect]}
          className="relative z-10 inline-flex items-center justify-center"
        >
          {icon}
        </motion.span>
      )}
      {badge}
    </>
  );

  if (href) {
    if (reduceMotion) {
      return (
        <Link href={href} aria-label={label} className={classes}>
          {content}
        </Link>
      );
    }
    return (
      <MotionLink
        href={href}
        aria-label={label}
        className={classes}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover="hover"
        whileTap="tap"
        variants={chipVariants}
        transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      >
        {content}
      </MotionLink>
    );
  }

  if (reduceMotion) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        aria-expanded={expanded}
        className={classes}
      >
        {content}
      </button>
    );
  }

  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-expanded={expanded}
      className={classes}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover="hover"
      whileTap="tap"
      variants={chipVariants}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {content}
    </motion.button>
  );
}

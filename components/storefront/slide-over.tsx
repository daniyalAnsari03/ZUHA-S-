"use client";

import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
} from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

type SlideOverProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  side?: "left" | "right";
  children: ReactNode;
  labelledById?: string;
  /**
   * Optional width/panel classes that replace the default
   * `max-w-xs sm:max-w-sm` sizing (e.g. a wider admin drawer).
   */
  panelClassName?: string;
};

/**
 * Content wrapper variant. Passing the hidden/visible labels down lets panel
 * children (menu rows, search results) cascade in on open.
 */
const contentVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05, delayChildren: 0.12 } },
};

/**
 * Accessible slide-over panel (drawer) rendered in a portal. Handles Escape,
 * backdrop click, initial focus and focus return on close. Keeps the storefront
 * interactive beneath it rather than navigating — used for the menu, search,
 * wishlist and cart entry points. Opens with a premium spring slide, a gradient
 * top accent and staggered inner content.
 */
export function SlideOver({
  open,
  onClose,
  title,
  side = "right",
  children,
  labelledById,
  panelClassName,
}: SlideOverProps) {
  const panelRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;

    const previousFocus = document.activeElement as HTMLElement | null;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);

    const focusTarget =
      panelRef.current?.querySelector<HTMLElement>("[data-autofocus]") ??
      panelRef.current;
    focusTarget?.focus();

    return () => {
      document.removeEventListener("keydown", handleKey);
      previousFocus?.focus?.();
    };
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  const offscreen = side === "right" ? "100%" : "-100%";
  const panelVariants: Variants = reduceMotion
    ? {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0.2 } },
      }
    : {
        hidden: { x: offscreen, opacity: 0.5 },
        visible: {
          x: 0,
          opacity: 1,
          transition: { type: "spring", stiffness: 300, damping: 34, mass: 0.9 },
        },
      };

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.button
            type="button"
            aria-label="Close overlay"
            className="absolute inset-0 m-0 h-full w-full cursor-default border-0 bg-charcoal/40 p-0 outline-none backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
          />
          <motion.aside
            ref={panelRef}
            id={labelledById}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={cn(
              "absolute top-0 flex h-full flex-col overflow-hidden border-plum-dark/15 bg-gradient-to-b from-ivory to-cream shadow-2xl",
              panelClassName ?? "w-full max-w-xs sm:max-w-sm",
              side === "right"
                ? "right-0 border-l sm:rounded-l-3xl"
                : "left-0 border-r sm:rounded-r-3xl",
            )}
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={panelVariants}
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-soft to-transparent"
            />
            <div className="relative flex shrink-0 items-center justify-between border-b border-plum-dark/30 bg-gradient-to-r from-plum-dark to-plum px-5 py-4 sm:px-6">
              <h2 className="font-serif text-lg text-ivory">{title}</h2>
              <motion.button
                type="button"
                onClick={onClose}
                data-autofocus
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-ivory/90 transition-colors hover:border-gold-soft/60 hover:bg-white/10 hover:text-gold-soft focus-visible:outline-gold-soft"
                aria-label={`Close ${title}`}
                whileHover={{ rotate: 90, scale: 1.08 }}
                whileTap={{ scale: 0.9 }}
                transition={{ type: "spring", stiffness: 320, damping: 20 }}
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </motion.button>
            </div>
            <motion.div
              className="flex-1 overflow-y-auto overscroll-contain"
              variants={contentVariants}
            >
              {children}
            </motion.div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

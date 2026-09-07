"use client";

import { AnimatePresence, motion } from "framer-motion";
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
};

const easing: [number, number, number, number] = [0.22, 1, 0.36, 1];

/**
 * Accessible slide-over panel (drawer) rendered in a portal. Handles Escape,
 * backdrop click, initial focus and focus return on close. Keeps the storefront
 * interactive beneath it rather than navigating — used for the menu, search,
 * wishlist and cart entry points.
 */
export function SlideOver({
  open,
  onClose,
  title,
  side = "right",
  children,
  labelledById,
}: SlideOverProps) {
  const panelRef = useRef<HTMLElement>(null);

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
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.aside
            ref={panelRef}
            id={labelledById}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={cn(
              "absolute top-0 flex h-full flex-col border-charcoal/10 bg-white shadow-2xl",
              side === "right" ? "right-0 border-l" : "left-0 border-r",
              side === "right" ? "w-full max-w-md" : "w-full max-w-xs sm:max-w-sm",
            )}
            initial={{ x: side === "right" ? "100%" : "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: side === "right" ? "100%" : "-100%" }}
            transition={{ type: "tween", duration: 0.28, ease: easing }}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-charcoal/10 px-5 py-4 sm:px-6">
              <h2 className="font-serif text-lg text-charcoal">
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                data-autofocus
                className="inline-flex h-10 w-10 items-center justify-center rounded-full text-charcoal transition-colors hover:bg-plum/5 focus-visible:outline-plum"
                aria-label={`Close ${title}`}
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {children}
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
"use client";

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
 * Accessible slide-over panel (drawer) rendered in a portal. Handles Escape,
 * backdrop click, initial focus and focus return on close. Keeps the storefront
 * interactive beneath it rather than navigating — used for the menu, search,
 * wishlist and cart entry points. Opens with a spring-like slide, a gradient
 * top accent and staggered inner content.
 *
 * The panel motion is CSS. The drawer chrome is rendered by the navbar, which
 * is in the first viewport of every storefront page, so it carries no
 * JavaScript animation runtime.
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

  if (typeof document === "undefined" || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close overlay"
        className="slide-over-backdrop absolute inset-0 m-0 h-full w-full cursor-default border-0 bg-charcoal/40 p-0 outline-none backdrop-blur-[2px]"
        onClick={onClose}
      />
      <aside
        ref={panelRef}
        id={labelledById}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "slide-over-panel absolute top-0 flex h-full flex-col overflow-hidden border-plum-dark/15 bg-gradient-to-b from-ivory to-cream shadow-2xl",
          side === "right" ? "slide-from-right" : "slide-from-left",
          panelClassName ?? "w-full max-w-xs sm:max-w-sm",
          side === "right" ? "right-0 border-l" : "left-0 border-r",
        )}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-soft to-transparent"
        />
        <div className="relative flex shrink-0 items-center justify-between border-b border-plum-dark/30 bg-gradient-to-r from-plum-dark to-plum px-5 py-4 sm:px-6">
          <h2 className="font-serif text-lg text-ivory">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            data-autofocus
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 text-ivory/90 transition-[transform,background-color,border-color,color] duration-300 hover:rotate-90 hover:scale-105 hover:border-gold-soft/60 hover:bg-white/10 hover:text-gold-soft focus-visible:outline-gold-soft active:scale-90"
            aria-label={`Close ${title}`}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="slide-over-content flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </aside>
    </div>,
    document.body,
  );
}

import type { CSSProperties, ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
};

/**
 * Subtle scroll-reveal wrapper used across the storefront.
 *
 * Implemented with a CSS scroll-driven animation (`animation-timeline: view()`)
 * instead of a JS animation library, so revealing a section costs zero
 * JavaScript, zero observers and zero main-thread work. The markup is a single
 * element with no extra wrappers. Browsers without scroll-driven animation
 * support render the content immediately, and the global
 * `prefers-reduced-motion` block disables the animation for users who ask for
 * reduced motion.
 */
export function Reveal({ children, className, delay = 0 }: RevealProps) {
  return (
    <div
      className={className ? `reveal-scroll ${className}` : "reveal-scroll"}
      style={{ "--reveal-delay": `${delay}s` } as CSSProperties}
    >
      {children}
    </div>
  );
}

"use client";

import { motion, useReducedMotion, type Transition } from "framer-motion";
import type { ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
};

const ease: Transition["ease"] = [0.22, 1, 0.36, 1];

/**
 * Subtle scroll-reveal wrapper used across the storefront. Renders a plain
 * element when the user prefers reduced motion.
 */
export function Reveal({ children, className, delay = 0 }: RevealProps) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, delay, ease }}
    >
      {children}
    </motion.div>
  );
}
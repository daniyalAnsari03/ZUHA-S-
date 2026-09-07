import { forwardRef, type InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
};

/**
 * Reusable premium input primitive. `invalid` renders an error state
 * for use with form validation (e.g. react-hook-form + zod).
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, ...props }, ref) => (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        "h-11 w-full rounded-lg border border-charcoal/15 bg-white px-4 text-sm text-charcoal",
        "placeholder:text-charcoal-muted/60 transition-colors",
        "focus:border-plum focus:outline-none focus:ring-2 focus:ring-plum/15",
        "disabled:cursor-not-allowed disabled:opacity-50",
        invalid && "border-red-500 focus:border-red-500 focus:ring-red-500/15",
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = "Input";

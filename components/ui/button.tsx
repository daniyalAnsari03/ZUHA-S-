import { forwardRef, type ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "outline" | "ghost" | "gold";
type ButtonSize = "sm" | "md" | "lg" | "icon";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-plum text-white hover:bg-plum-dark focus-visible:outline-plum disabled:opacity-50",
  outline:
    "border border-charcoal/20 bg-transparent text-charcoal hover:border-plum hover:text-plum disabled:opacity-50",
  ghost: "bg-transparent text-charcoal hover:bg-plum/5 disabled:opacity-50",
  gold: "bg-gold-muted text-white hover:bg-gold-soft hover:text-charcoal disabled:opacity-50",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-6 text-sm",
  lg: "h-12 px-8 text-base",
  icon: "h-10 w-10",
};

/**
 * Reusable premium button primitive.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium tracking-wide transition-colors duration-200",
        "disabled:cursor-not-allowed disabled:pointer-events-none",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  ),
);

Button.displayName = "Button";

import { cn } from "@/lib/utils";

type SpinnerProps = {
  className?: string;
  size?: "sm" | "md" | "lg";
};

const sizeClasses = {
  sm: "h-4 w-4 border-2",
  md: "h-6 w-6 border-2",
  lg: "h-10 w-10 border-[3px]",
};

/**
 * Accessible loading spinner used across loading boundaries.
 */
export function Spinner({ className, size = "md" }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-live="polite"
      aria-label="Loading"
      className={cn(
        "inline-block animate-spin rounded-full border-plum border-t-transparent",
        sizeClasses[size],
        className,
      )}
    />
  );
}

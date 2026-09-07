"use client";

import { ShoppingBag } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type AddToBagButtonProps = {
  productName: string;
  className?: string;
};

/**
 * Add to Bag entry on product cards. Cart/checkout is a later phase, so this
 * control is an honest placeholder: it never claims an item was persisted.
 */
export function AddToBagButton({ productName, className }: AddToBagButtonProps) {
  const [hint, setHint] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const handleClick = () => {
    setHint(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setHint(false), 2600);
  };

  return (
    <Button
      type="button"
      variant="primary"
      className={cn("w-full", className)}
      onClick={handleClick}
      disabled={hint}
      aria-live="polite"
    >
      <ShoppingBag className="h-4 w-4" aria-hidden="true" />
      {hint ? "Cart arriving soon" : `Add ${productName} to Bag`}
    </Button>
  );
}
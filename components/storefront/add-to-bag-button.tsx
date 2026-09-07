"use client";

import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useStorefront } from "./storefront-provider";

type AddToBagButtonProps = {
  productId: string;
  className?: string;
};

/**
 * Functional Add to Bag control used on product cards. Adds the product to the
 * authenticated customer's cart through the service layer and reports clear
 * success/error feedback. Guests are directed to sign in.
 */
export function AddToBagButton({ productId, className }: AddToBagButtonProps) {
  const { addToCart } = useStorefront();
  const [status, setStatus] = useState<"idle" | "busy" | "added" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const handleClick = async () => {
    if (status === "busy") return;
    setStatus("busy");
    setMessage(null);

    const error = await addToCart(productId, 1);

    if (error) {
      setStatus("error");
      setMessage(error);
      timer.current = setTimeout(() => {
        setStatus("idle");
        setMessage(null);
      }, 3200);
      return;
    }

    setStatus("added");
    setMessage("Added to your bag");
    timer.current = setTimeout(() => {
      setStatus("idle");
      setMessage(null);
    }, 2000);
  };

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Button
        type="button"
        variant="primary"
        className="w-full"
        onClick={handleClick}
        disabled={status === "busy"}
        aria-live="polite"
      >
        {status === "busy" ? (
          "Adding…"
        ) : status === "added" ? (
          <>
            <Check className="h-4 w-4" aria-hidden="true" />
            Added
          </>
        ) : (
          "ADD TO BAG"
        )}
      </Button>
      <p
        aria-live="polite"
        className={cn(
          "min-h-4 text-center text-[11px]",
          status === "error" ? "text-red-600" : "text-plum",
        )}
      >
        {message ?? "\u00A0"}
      </p>
    </div>
  );
}
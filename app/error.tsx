"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="font-serif text-2xl">Something went wrong</h1>
      <p className="max-w-md text-sm text-charcoal-muted">
        We could not complete this request. Please try again.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}

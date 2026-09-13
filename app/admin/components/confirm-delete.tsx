"use client";

import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

type ConfirmDeleteProps = {
  title: string;
  description: string;
  confirmLabel?: string;
  action: () => Promise<ActionResult>;
  /** Navigate somewhere after a successful delete, e.g. "/admin/products". */
  redirectTo?: string;
  className?: string;
  iconClassName?: string;
  /** When true (default) a "Delete" label is shown next to the icon. */
  showLabel?: boolean;
};

/**
 * Generic confirmation dialog for destructive admin actions. Never deletes
 * anything without an explicit confirm click and never reports success without
 * the server action returning ok.
 */
export function ConfirmDelete({
  title,
  description,
  confirmLabel = "Delete",
  action,
  redirectTo,
  className = "",
  iconClassName = "",
  showLabel = true,
}: ConfirmDeleteProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = () => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        setOpen(false);
        if (redirectTo) {
          router.push(redirectTo);
        } else {
          router.refresh();
        }
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className={`inline-flex items-center justify-center gap-1.5 text-charcoal-muted transition-colors hover:text-red-600 ${className}`}
        aria-label={title}
      >
        <Trash2 className={iconClassName || "h-4 w-4"} aria-hidden="true" />
        {showLabel ? <span className="text-sm">Delete</span> : null}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-label="Cancel"
          />
          <div className="relative w-full max-w-md rounded-2xl border border-charcoal/10 bg-white p-6 shadow-xl">
            <h3 className="font-serif text-lg text-charcoal">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-charcoal-muted">
              {description}
            </p>

            {error && (
              <p
                className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
                role="alert"
              >
                {error}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="rounded-lg border border-charcoal/15 px-4 py-2 text-sm font-medium text-charcoal transition-colors hover:border-plum hover:text-plum disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={run}
                disabled={pending}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : null}
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
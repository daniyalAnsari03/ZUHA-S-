"use client";

import { useRouter } from "next/navigation";
import { Minus, Plus, X } from "lucide-react";
import { useState } from "react";

import { updateStockAction } from "@/app/admin/actions";

type StockAdjustDialogProps = {
  productId: string;
  productName: string;
  currentStock: number;
  currentThreshold: number;
};

export function StockAdjustDialog({
  productId,
  productName,
  currentStock,
  currentThreshold,
}: StockAdjustDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [stock, setStock] = useState(currentStock);
  const [threshold, setThreshold] = useState(currentThreshold);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  const reset = () => {
    setStock(currentStock);
    setThreshold(currentThreshold);
    setMessage(null);
  };

  const submit = async () => {
    setBusy(true);
    setMessage(null);
    const result = await updateStockAction(productId, stock, threshold);
    setBusy(false);
    if (result.ok) {
      setMessage({ ok: true, text: result.message ?? "Stock updated." });
      router.refresh();
    } else {
      setMessage({ ok: false, text: result.error });
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className="inline-flex items-center gap-1 rounded-md border border-charcoal/15 bg-neutral-soft px-2.5 py-1.5 text-xs font-medium text-charcoal transition-colors hover:border-plum hover:text-plum"
      >
        <Plus className="h-3 w-3" aria-hidden="true" />
        Adjust
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Adjust stock for ${productName}`}
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-label="Close dialog"
          />
          <div className="relative w-full max-w-md rounded-2xl border border-charcoal/10 bg-neutral-soft p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-serif text-lg text-charcoal">
                  Adjust stock
                </h3>
                <p className="mt-0.5 line-clamp-1 text-sm text-charcoal-muted">
                  {productName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-charcoal-muted transition-colors hover:bg-cream hover:text-plum"
                aria-label="Close"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <p className="mt-4 rounded-lg bg-cream/60 px-3 py-2 text-xs text-charcoal-muted">
              Values you set here will be applied immediately. Setting stock
              below a product&apos;s threshold triggers a low-stock alert.
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor={`stock-${productId}`}
                  className="block text-xs font-medium text-charcoal"
                >
                  Stock quantity
                </label>
                <div className="mt-1.5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStock((s) => Math.max(0, s - 1))}
                    className="rounded-lg border border-charcoal/15 p-2 text-charcoal transition-colors hover:border-plum hover:text-plum"
                    aria-label="Decrease stock"
                  >
                    <Minus className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <input
                    id={`stock-${productId}`}
                    type="number"
                    min={0}
                    step={1}
                    value={stock}
                    onChange={(e) =>
                      setStock(Math.max(0, e.target.valueAsNumber || 0))
                    }
                    className="w-full rounded-lg border border-charcoal/15 bg-ivory px-3 py-2 text-sm tabular-nums text-charcoal focus:border-plum focus:outline-none focus:ring-2 focus:ring-plum/15"
                  />
                  <button
                    type="button"
                    onClick={() => setStock((s) => s + 1)}
                    className="rounded-lg border border-charcoal/15 p-2 text-charcoal transition-colors hover:border-plum hover:text-plum"
                    aria-label="Increase stock"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor={`threshold-${productId}`}
                  className="block text-xs font-medium text-charcoal"
                >
                  Low-stock threshold
                </label>
                <input
                  id={`threshold-${productId}`}
                  type="number"
                  min={0}
                  step={1}
                  value={threshold}
                  onChange={(e) =>
                    setThreshold(Math.max(0, e.target.valueAsNumber || 0))
                  }
                  className="mt-1.5 w-full rounded-lg border border-charcoal/15 bg-ivory px-3 py-2 text-sm tabular-nums text-charcoal focus:border-plum focus:outline-none focus:ring-2 focus:ring-plum/15"
                />
              </div>
            </div>

            {message && (
              <p
                className={`mt-4 rounded-lg px-3 py-2 text-sm ${
                  message.ok
                    ? "bg-green-50 text-green-700"
                    : "bg-red-50 text-red-700"
                }`}
                role={message.ok ? "status" : "alert"}
              >
                {message.text}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-charcoal/15 px-4 py-2 text-sm font-medium text-charcoal transition-colors hover:border-plum hover:text-plum"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={busy}
                className="rounded-lg bg-plum px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-plum-dark disabled:opacity-50"
              >
                {busy ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

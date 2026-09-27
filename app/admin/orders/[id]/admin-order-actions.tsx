"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { updateOrderStatusAction } from "@/app/storefront/actions";
import type { OrderStatus } from "@/lib/supabase/types";

const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Order Placed",
  confirmed: "Confirmed",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export function AdminOrderActions({
  orderId,
  currentStatus,
}: {
  orderId: string;
  currentStatus: OrderStatus;
}) {
  const router = useRouter();
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | "">("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(
    null,
  );

  const allowed = VALID_TRANSITIONS[currentStatus] ?? [];

  const handleUpdate = async () => {
    if (!selectedStatus) return;
    setLoading(true);
    setResult(null);

    const res = await updateOrderStatusAction(
      orderId,
      selectedStatus,
      note || undefined,
    );
    setResult({ ok: res.ok, message: res.ok ? res.message : res.error });

    if (res.ok) {
      setSelectedStatus("");
      setNote("");
      router.refresh();
    }
    setLoading(false);
  };

  return (
    <section className="rounded-xl border border-charcoal/10 bg-neutral-soft p-6">
      <h2 className="font-serif text-lg text-charcoal">Update Status</h2>

      {allowed.length === 0 ? (
        <p className="mt-3 text-sm text-charcoal-muted">
          This order is in a final state. No further status changes are
          possible.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            {allowed.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSelectedStatus(s)}
                className={`inline-flex items-center rounded-full px-4 py-1.5 text-xs font-medium capitalize transition-colors ${
                  selectedStatus === s
                    ? "bg-plum text-white"
                    : "border border-charcoal/15 bg-neutral-soft text-charcoal hover:border-plum hover:text-plum"
                }`}
              >
                {STATUS_LABELS[s] ?? s}
              </button>
            ))}
          </div>

          {selectedStatus && (
            <>
              <div>
                <label
                  htmlFor="admin-order-note"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-charcoal-muted"
                >
                  Note (optional)
                </label>
                <textarea
                  id="admin-order-note"
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add a note about this status change…"
                  className="w-full rounded-lg border border-charcoal/15 bg-ivory px-4 py-2.5 text-sm text-charcoal placeholder:text-charcoal-muted/60 focus:border-plum focus:outline-none focus:ring-2 focus:ring-plum/15"
                />
              </div>

              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={loading}
                onClick={handleUpdate}
              >
                {loading
                  ? "Updating…"
                  : `Update to ${STATUS_LABELS[selectedStatus]}`}
              </Button>
            </>
          )}

          {result && (
            <p
              className={`text-sm ${result.ok ? "text-green-700" : "text-red-600"}`}
            >
              {result.message}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

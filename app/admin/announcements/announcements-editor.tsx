"use client";

import { useActionState, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import {
  saveCmsAnnouncementsAction,
  type ActionResult,
} from "@/app/admin/actions";

type AnnouncementItem = {
  id: string;
  message: string;
  href: string;
  active: boolean;
  order: number;
  durationMs: number;
};

type AnnouncementsEditorProps = {
  announcements: AnnouncementItem[];
};

function generateId(): string {
  return `announcement-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function AnnouncementsEditor({
  announcements: initial,
}: AnnouncementsEditorProps) {
  const [state, formAction, pending] = useActionState(
    saveCmsAnnouncementsAction,
    { ok: true } satisfies ActionResult,
  );

  const [items, setItems] = useState<AnnouncementItem[]>(initial);

  const updateItem = (
    index: number,
    field: keyof AnnouncementItem,
    value: string | boolean | number,
  ) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, [field]: value } : item,
      ),
    );
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: generateId(),
        message: "",
        href: "",
        active: true,
        order: prev.length + 1,
        durationMs: 5000,
      },
    ]);
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-3xl text-charcoal">Announcements</h1>
        <p className="mt-1 text-sm text-charcoal-muted">
          Manage the rotating announcement bar at the top of the storefront.
          Only one message is visible at a time.
        </p>
      </div>

      <form
        action={async (formData: FormData) => {
          formData.set("data", JSON.stringify(items));
          formAction(formData);
        }}
        className="space-y-6"
      >
        {state.ok === false && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        )}
        {state.ok === true && state.message && (
          <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
            {state.message}
          </p>
        )}

        <div className="space-y-4">
          {items.map((item, index) => (
            <div
              key={item.id}
              className="rounded-2xl border border-charcoal/10 bg-neutral-soft p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-4">
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-charcoal-muted">
                      Message *
                    </span>
                    <input
                      type="text"
                      value={item.message}
                      onChange={(e) =>
                        updateItem(index, "message", e.target.value)
                      }
                      className="w-full rounded-lg border border-charcoal/15 bg-ivory px-3 py-2 text-sm text-charcoal outline-none focus:border-plum focus:ring-2 focus:ring-plum/10"
                      placeholder="Complimentary shipping on orders over PKR 15,000"
                      required
                    />
                  </label>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-charcoal-muted">
                        Link (optional)
                      </span>
                      <input
                        type="text"
                        value={item.href}
                        onChange={(e) =>
                          updateItem(index, "href", e.target.value)
                        }
                        className="w-full rounded-lg border border-charcoal/15 bg-ivory px-3 py-2 text-sm text-charcoal outline-none focus:border-plum focus:ring-2 focus:ring-plum/10"
                        placeholder="/shop"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-charcoal-muted">
                        Duration (ms)
                      </span>
                      <input
                        type="number"
                        value={item.durationMs}
                        onChange={(e) =>
                          updateItem(
                            index,
                            "durationMs",
                            parseInt(e.target.value) || 5000,
                          )
                        }
                        className="w-full rounded-lg border border-charcoal/15 bg-ivory px-3 py-2 text-sm text-charcoal outline-none focus:border-plum focus:ring-2 focus:ring-plum/10"
                        min="1000"
                        step="1000"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-charcoal-muted">
                        Order
                      </span>
                      <input
                        type="number"
                        value={item.order}
                        onChange={(e) =>
                          updateItem(
                            index,
                            "order",
                            parseInt(e.target.value) || 0,
                          )
                        }
                        className="w-full rounded-lg border border-charcoal/15 bg-ivory px-3 py-2 text-sm text-charcoal outline-none focus:border-plum focus:ring-2 focus:ring-plum/10"
                        min="0"
                      />
                    </label>
                  </div>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={item.active}
                      onChange={(e) =>
                        updateItem(index, "active", e.target.checked)
                      }
                      className="h-4 w-4 rounded border-charcoal/20 accent-plum"
                    />
                    <span className="text-sm text-charcoal">Active</span>
                  </label>
                </div>

                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="rounded-lg p-2 text-charcoal-muted transition-colors hover:bg-red-50 hover:text-red-600"
                  aria-label="Remove announcement"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-plum px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-plum-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Saving..." : "Save Announcements"}
          </button>
          <button
            type="button"
            onClick={addItem}
            className="inline-flex items-center gap-2 rounded-full border border-charcoal/15 px-5 py-2.5 text-sm font-medium text-charcoal-muted transition-colors hover:border-plum/40 hover:text-plum"
          >
            <Plus className="h-4 w-4" />
            Add Announcement
          </button>
        </div>
      </form>
    </div>
  );
}

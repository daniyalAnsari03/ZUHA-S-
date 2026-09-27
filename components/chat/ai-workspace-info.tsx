"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  LineChart,
  Package,
  ShieldCheck,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";

const TEAM = [
  {
    icon: Package,
    label: "Catalog & inventory",
    description: "Products, publishing and stock levels.",
  },
  {
    icon: LineChart,
    label: "Orders & sales",
    description: "Order status, revenue and performance.",
  },
  {
    icon: Users,
    label: "Customers",
    description: "Profiles and order history.",
  },
  {
    icon: ShieldCheck,
    label: "Guardrails & audit",
    description: "Every action authorized and logged.",
  },
];

const SAFETY = [
  "Your requests are routed to the right employee automatically.",
  "Write actions are admin-only and blocked for anyone else.",
  "Nothing is reported as done unless the database confirms it.",
  "Every action is written to the AI audit trail.",
];

export function AdminWorkspaceInfoAccordion() {
  const [open, setOpen] = useState(false);

  return (
    <section className="overflow-hidden rounded-2xl border border-charcoal/10 bg-neutral-soft">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="admin-ai-workspace-info"
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-cream/60"
      >
        <span className="font-serif text-base text-charcoal">
          About this workspace
        </span>
        <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-plum">
          {open ? "Hide" : "Show"}
          <ChevronDown
            className={cn(
              "h-4 w-4 text-plum transition-transform duration-200",
              open && "rotate-180",
            )}
            aria-hidden="true"
          />
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id="admin-ai-workspace-info"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden border-t border-charcoal/5"
          >
            <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
              <div className="rounded-2xl bg-ivory p-5">
                <h3 className="font-serif text-base text-charcoal">
                  Your team
                </h3>
                <ul className="mt-3 space-y-3">
                  {TEAM.map((member) => (
                    <li key={member.label} className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-plum/10">
                        <member.icon
                          className="h-4 w-4 text-plum"
                          aria-hidden="true"
                        />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-charcoal">
                          {member.label}
                        </p>
                        <p className="text-xs leading-relaxed text-charcoal-muted">
                          {member.description}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-plum/15 bg-plum/5 p-5">
                <h3 className="font-serif text-base text-charcoal">
                  How it stays safe
                </h3>
                <ul className="mt-3 space-y-2 text-xs leading-relaxed text-charcoal-muted">
                  {SAFETY.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-plum/60" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

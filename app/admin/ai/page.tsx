import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LineChart, Package, ShieldCheck, Users } from "lucide-react";

import { getAuthUser } from "@/lib/auth/session";
import { AiAuditLogViewer } from "@/components/chat/ai-audit-log-viewer";
import { AdminAiWorkplacePanel } from "@/components/chat/admin-ai-workplace-panel";

export const metadata: Metadata = {
  title: "AI Workplace · Admin",
  robots: { index: false, follow: false },
};

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

export default async function AdminAIWorkplacePage() {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") redirect("/login");

  return (
    <div>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-charcoal">AI Workplace</h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-charcoal-muted">
            Your AI Manager and employees. Ask for product changes, stock,
            orders, customers, sales or marketing — the workforce acts through
            guarded, audited tools and always reports verified results.
          </p>
        </div>
        <span className="inline-flex rounded-full bg-cream px-3 py-1.5 text-xs font-semibold text-plum ring-1 ring-plum/20">
          Phase 7 — operational
        </span>
      </header>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_24rem]">
        <div className="min-w-0">
          <AdminAiWorkplacePanel initialConversationId={null} />
        </div>

        <aside className="flex min-w-0 flex-col gap-4">
          <div className="rounded-2xl border border-charcoal/10 bg-neutral-soft p-5">
            <h2 className="font-serif text-base text-charcoal">Your team</h2>
            <ul className="mt-3 space-y-3">
              {TEAM.map((member) => (
                <li key={member.label} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-plum/10">
                    <member.icon
                      className="h-4 w-4 text-plum"
                      aria-hidden="true"
                    />
                  </span>
                  <div>
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
            <h2 className="font-serif text-base text-charcoal">How it stays safe</h2>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-charcoal-muted">
              <li>
                • Your requests are routed to the right employee automatically.
              </li>
              <li>
                • Write actions are admin-only and blocked for anyone else.
              </li>
              <li>
                • Nothing is reported as done unless the database confirms it.
              </li>
              <li>
                • Every action is written to the AI audit trail.
              </li>
            </ul>
          </div>

          <AiAuditLogViewer />
        </aside>
      </div>
    </div>
  );
}
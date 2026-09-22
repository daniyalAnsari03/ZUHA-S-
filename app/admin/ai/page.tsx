import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getAuthUser } from "@/lib/auth/session";
import { AdminAiWorkplacePanel } from "@/components/chat/admin-ai-workplace-panel";
import { AdminWorkspaceInfoAccordion } from "@/components/chat/ai-workspace-info";

export const metadata: Metadata = {
  title: "AI Workplace · Admin",
  robots: { index: false, follow: false },
};

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

      <div className="mt-6">
        <AdminAiWorkplacePanel initialConversationId={null} />

        <div className="mt-6">
          <AdminWorkspaceInfoAccordion />
        </div>
      </div>
    </div>
  );
}
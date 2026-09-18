import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  MessageCircle,
  MessageSquareOff,
  Plus,
  Save,
  Trash2,
  Zap,
} from "lucide-react";

import { getAuthUser } from "@/lib/auth/session";
import { getWhatsappConfig } from "@/services/whatsapp/config";
import { getWhatsappSettings } from "@/services/whatsapp/whatsapp-settings";
import { listApprovedRecipients } from "@/services/whatsapp/whatsapp-recipients";
import {
  addRecipientAction,
  deleteRecipientAction,
  toggleRecipientAction,
  updateWhatsappSettingsAction,
} from "@/app/admin/integrations/actions";

export const metadata: Metadata = {
  title: "Integrations · Admin",
  robots: { index: false, follow: false },
};

export default async function AdminIntegrationsPage() {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") redirect("/login");

  const config = getWhatsappConfig();

  let settings;
  let settingsError = false;
  try {
    settings = await getWhatsappSettings();
  } catch (error) {
    settingsError = true;
    console.error("[admin] whatsapp settings load failed:", error);
  }

  let recipients: Awaited<ReturnType<typeof listApprovedRecipients>> = [];
  let recipientsError = false;
  try {
    recipients = await listApprovedRecipients();
  } catch (error) {
    recipientsError = true;
    console.error("[admin] whatsapp recipients load failed:", error);
  }

  const requireApprovalForSend = settings?.require_approval_for_send ?? true;

  return (
    <div>
      <div>
        <h1 className="font-serif text-3xl text-charcoal">Integrations</h1>
        <p className="mt-1 text-sm text-charcoal-muted">
          WhatsApp Cloud API connection, approved recipients and Guardian
          approval behavior.
        </p>
      </div>

      {/* Connection status */}
      <section className="mt-6 rounded-xl border border-charcoal/10 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full ${
                config.isConfigured ? "bg-plum/10 text-plum" : "bg-charcoal/10 text-charcoal-muted"
              }`}
            >
              {config.isConfigured ? (
                <MessageCircle className="h-5 w-5" aria-hidden="true" />
              ) : (
                <MessageSquareOff className="h-5 w-5" aria-hidden="true" />
              )}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-charcoal">
                WhatsApp Cloud API
              </h2>
              <p className="mt-0.5 text-xs text-charcoal-muted">
                {config.isConfigured
                  ? "Configured — webhook verification and outbound messaging enabled."
                  : config.isApiConfigured
                    ? "Partially configured — outbound messaging ready, webhook verify token missing."
                    : "Not configured — set WHATSAPP_* variables in the server environment to enable."}
              </p>
            </div>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              config.isConfigured
                ? "bg-plum/10 text-plum"
                : "bg-charcoal/10 text-charcoal-muted"
            }`}
          >
            {config.isConfigured ? "Connected" : "Not connected"}
          </span>
        </div>

        {!config.signatureVerificationEnabled && config.isConfigured && (
          <p className="mt-4 rounded-lg bg-cream px-3 py-2 text-xs text-charcoal-muted">
            Webhook signature verification is disabled. Set WHATSAPP_APP_SECRET
            to verify inbound payload signatures.
          </p>
        )}

        <div className="mt-4 border-t border-charcoal/10 pt-4">
          <details className="group">
            <summary className="cursor-pointer list-none text-sm font-medium text-plum">
              Webhook setup instructions
            </summary>
            <ol className="mt-3 space-y-1.5 text-xs leading-relaxed text-charcoal-muted">
              <li>
                1. In the Meta WhatsApp Cloud API dashboard, add the app webhook
                URL:{" "}
                <code className="rounded bg-cream px-1.5 py-0.5 text-charcoal">
                  https://YOUR_DOMAIN/api/whatsapp/webhook
                </code>
              </li>
              <li>
                2. Set the verify token to match{" "}
                <code className="rounded bg-cream px-1.5 py-0.5 text-charcoal">
                  WHATSAPP_WEBHOOK_VERIFY_TOKEN
                </code>{" "}
                and subscribe to the{" "}
                <code className="rounded bg-cream px-1.5 py-0.5 text-charcoal">
                  messages
                </code>{" "}
                field.
              </li>
              <li>
                3. Set{" "}
                <code className="rounded bg-cream px-1.5 py-0.5 text-charcoal">
                  WHATSAPP_APP_SECRET
                </code>{" "}
                in the app to enable payload signature verification.
              </li>
              <li>
                4. Senders are only processed when they match an approved admin
                recipient (below). Unknown numbers are ignored.
              </li>
            </ol>
          </details>
        </div>
      </section>

      {/* Settings */}
      <section className="mt-6 rounded-xl border border-charcoal/10 bg-white p-6">
        <h2 className="text-sm font-semibold text-charcoal">Settings</h2>
        {settingsError ? (
          <p className="mt-3 text-sm text-charcoal-muted">
            Settings could not be loaded right now.
          </p>
        ) : (
          <form
            action={updateWhatsappSettingsAction}
            className="mt-4 grid gap-4 sm:grid-cols-2"
          >
            <label className="block text-xs font-medium text-charcoal-muted">
              Business name (display)
              <input
                type="text"
                name="businessName"
                defaultValue={settings?.business_name ?? ""}
                placeholder="DINS by Daniyal"
                className="mt-1.5 w-full rounded-lg border border-charcoal/15 bg-ivory/50 px-3 py-2 text-sm text-charcoal outline-none transition-colors focus:border-plum"
              />
            </label>
            <label className="block text-xs font-medium text-charcoal-muted">
              Display phone
              <input
                type="text"
                name="displayPhone"
                defaultValue={settings?.display_phone ?? ""}
                placeholder="+92 300 0000000"
                className="mt-1.5 w-full rounded-lg border border-charcoal/15 bg-ivory/50 px-3 py-2 text-sm text-charcoal outline-none transition-colors focus:border-plum"
              />
            </label>
            <label className="block text-xs font-medium text-charcoal-muted">
              Phone number ID (display reference)
              <input
                type="text"
                name="phoneNumberId"
                defaultValue={settings?.phone_number_id ?? ""}
                placeholder="123456789012345"
                className="mt-1.5 w-full rounded-lg border border-charcoal/15 bg-ivory/50 px-3 py-2 text-sm text-charcoal outline-none transition-colors focus:border-plum"
              />
            </label>
            <div className="flex items-end pb-1">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-charcoal">
                <input
                  type="checkbox"
                  name="requireApprovalForSend"
                  defaultChecked={requireApprovalForSend}
                  className="h-4 w-4 rounded border-charcoal/30 accent-plum"
                />
                Require approval for AI WhatsApp sends
              </label>
            </div>
            <div className="sm:col-span-2">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-full bg-plum px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-plum-dark"
              >
                <Save className="h-4 w-4" aria-hidden="true" />
                Save settings
              </button>
            </div>
          </form>
        )}
      </section>

      {/* Recipients */}
      <section className="mt-6 rounded-xl border border-charcoal/10 bg-white p-6">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-charcoal">Approved recipients</h2>
          <Zap className="h-4 w-4 text-plum" aria-hidden="true" />
        </div>
        <p className="mt-1 text-xs text-charcoal-muted">
          The AI can only send WhatsApp messages and reports to these approved
          recipients. Numbers are matched exactly (normalized) — arbitrary
          numbers are always rejected.
        </p>

        {recipientsError ? (
          <p className="mt-4 text-sm text-charcoal-muted">
            Recipients could not be loaded right now.
          </p>
        ) : recipients.length === 0 ? (
          <p className="mt-4 rounded-lg bg-cream px-3 py-2 text-sm text-charcoal-muted">
            No recipients yet. Add the owner&apos;s phone number so the AI can
            reach WhatsApp.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-charcoal/5 overflow-hidden rounded-lg border border-charcoal/10">
            {recipients.map((recipient) => (
              <li
                key={recipient.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-charcoal">
                    {recipient.label}
                    <span className="ml-2 text-xs font-normal text-charcoal-muted">
                      {recipient.phone}
                    </span>
                  </p>
                  <p className="text-xs text-charcoal-muted">
                    {recipient.recipient_type}
                    {recipient.user_id ? " · linked to user account" : " · no user link"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      recipient.is_active
                        ? "bg-plum/10 text-plum"
                        : "bg-charcoal/10 text-charcoal-muted"
                    }`}
                  >
                    {recipient.is_active ? "Active" : "Inactive"}
                  </span>
                  <form action={toggleRecipientAction.bind(null, recipient.id, recipient.is_active)}>
                    <button
                      type="submit"
                      className="rounded-md border border-charcoal/15 px-2.5 py-1.5 text-xs font-medium text-charcoal-muted transition-colors hover:border-plum hover:text-plum"
                    >
                      {recipient.is_active ? "Pause" : "Enable"}
                    </button>
                  </form>
                  <form action={deleteRecipientAction.bind(null, recipient.id)}>
                    <button
                      type="submit"
                      aria-label={`Remove ${recipient.label}`}
                      className="rounded-md border border-charcoal/15 p-1.5 text-charcoal-muted transition-colors hover:border-red-700 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}

        <form
          action={addRecipientAction}
          className="mt-5 grid gap-3 rounded-xl border border-dashed border-charcoal/20 bg-cream/40 p-4 sm:grid-cols-3"
        >
          <label className="block text-xs font-medium text-charcoal-muted">
            Label
            <input
              type="text"
              name="label"
              required
              placeholder="Owner"
              className="mt-1.5 w-full rounded-lg border border-charcoal/15 bg-white px-3 py-2 text-sm text-charcoal outline-none transition-colors focus:border-plum"
            />
          </label>
          <label className="block text-xs font-medium text-charcoal-muted">
            Phone (Pakistan)
            <input
              type="tel"
              name="phone"
              required
              placeholder="+92 300 1234567"
              className="mt-1.5 w-full rounded-lg border border-charcoal/15 bg-white px-3 py-2 text-sm text-charcoal outline-none transition-colors focus:border-plum"
            />
          </label>
          <label className="block text-xs font-medium text-charcoal-muted">
            Type
            <select
              name="recipientType"
              defaultValue="admin"
              className="mt-1.5 w-full rounded-lg border border-charcoal/15 bg-white px-3 py-2 text-sm text-charcoal outline-none transition-colors focus:border-plum"
            >
              <option value="admin">Admin</option>
              <option value="customer">Customer</option>
            </select>
          </label>
          <div className="sm:col-span-3">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-full bg-plum px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-plum-dark"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add recipient
            </button>
          </div>
        </form>
      </section>

      <p className="mt-6 text-xs text-charcoal-muted">
        WhatsApp provider secrets (access token, app secret, verify token) live
        only in server environment variables — they are never stored in the
        database or shown here. Also see{" "}
        <Link href="/admin/ai" className="text-plum hover:text-plum-dark">
          the AI Workplace
        </Link>{" "}
        for Guardian decisions and pending approvals.
      </p>
    </div>
  );
}
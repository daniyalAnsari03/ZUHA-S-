import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
import { ServiceError } from "@/services/base";

/**
 * Store settings service (single-row `store_settings`).
 *
 * Holds non-secret store-level configuration. Phase 8 uses it for the
 * `report_email_address` — the recipient the automated report engine delivers
 * to. Secrets (Resend key) never live here; they stay in server env vars.
 *
 * SECURITY: record writes go through the service-role client because the
 * Admin UI and cron run server-side; callers are responsible for admin
 * authorization BEFORE calling. Read-back verification is used after every
 * change so callers never trust the write blindly.
 */

type StoreSettingsRow = Database["public"]["Tables"]["store_settings"]["Row"];

export function getReportEmailAddress(): Promise<string | null> {
  return getStoreSettings().then(
    (settings) => settings.report_email_address ?? null,
  );
}

export async function getStoreSettings(): Promise<StoreSettingsRow> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("store_settings")
    .select("report_email_address, id, created_at, updated_at")
    .eq("id", true)
    .maybeSingle();

  if (error) {
    throw new ServiceError(
      "STORE_SETTINGS_READ_FAILED",
      "Failed to load store settings.",
      error,
    );
  }

  if (!data) {
    throw new ServiceError(
      "STORE_SETTINGS_MISSING",
      "Store settings are not initialized. Run the Phase 8 migration.",
    );
  }

  return data as StoreSettingsRow;
}

/**
 * Set the report recipient address. Validates format; empty/null clears it.
 * Verifies the stored value after writing.
 */
export async function setReportEmailAddress(
  email: string | null,
): Promise<StoreSettingsRow> {
  const normalized = email?.trim();
  if (normalized && !EMAIL_PATTERN.test(normalized)) {
    throw new ServiceError(
      "REPORT_EMAIL_INVALID",
      "Please enter a valid email address.",
    );
  }

  const supabase = createAdminClient();
  const value = normalized || null;

  const { error } = await supabase
    .from("store_settings")
    .update({ report_email_address: value })
    .eq("id", true);

  if (error) {
    throw new ServiceError(
      "STORE_SETTINGS_UPDATE_FAILED",
      "Failed to update store settings.",
      error,
    );
  }

  const stored = await getStoreSettings();
  if (stored.report_email_address !== value) {
    throw new ServiceError(
      "STORE_SETTINGS_VERIFY_FAILED",
      "The email address could not be verified after saving.",
    );
  }

  return stored;
}

/**
 * Resolve who the report should be delivered to.
 * Order: configured store recipient → explicit fallback (e.g. the signed-in
 * admin's email in the Admin UI). Never guesses or invents an address.
 */
export async function resolveReportRecipient(
  fallback?: string | null,
): Promise<string | null> {
  const configured = await getReportEmailAddress().catch(() => null);
  if (configured) return configured;
  if (fallback?.trim()) return fallback.trim();
  return null;
}

/** Loose email pattern used for the report recipient field. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

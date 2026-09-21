-- Phase 8 — Email Automation & AI Reporting.
--
-- Adds durable storage for the automated business report emails:
--   store_settings — single-row settings row holding the report recipient
--                    email address (report_email_address) chosen by the admin.
--   email_logs     — audit trail for every report email (daily/weekly/manual):
--                    recipient, type, subject, send status, the AI insight,
--                    the provider message id and failure detail. Fail-closed:
--                    a failed send is recorded as 'failed' and surfaced in the
--                    Admin UI.
--
-- SECURITY MODEL:
--   * No secrets are stored here. Resend API key lives only in server
--     environment variables.
--   * All Phase 8 server writes use the service-role client (bypasses RLS by
--     design) behind application-level authorization (admin role or cron auth).
--   * Both tables are read/updated by admins via RLS (public.is_admin) so the
--     Admin UI works with the authenticated session too.
--   * The `anon` role has no grants on either table.

-- ===========================================================================
-- 1. store_settings (single-row, admin-managed)
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.store_settings (
  id                  boolean PRIMARY KEY DEFAULT true,
  report_email_address text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT store_settings_single_row CHECK (id)
);

COMMENT ON TABLE public.store_settings IS
  'Single-row store-level settings (id = TRUE). Holds the report_email_address the AI reporting engine delivers to. Never stores credentials.';

CREATE OR REPLACE FUNCTION public.set_store_settings_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_store_settings_updated_at ON public.store_settings;
CREATE TRIGGER trg_store_settings_updated_at
  BEFORE UPDATE ON public.store_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_store_settings_updated_at();

ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read store settings" ON public.store_settings;
CREATE POLICY "Admins can read store settings"
  ON public.store_settings
  FOR SELECT
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage store settings" ON public.store_settings;
CREATE POLICY "Admins can manage store settings"
  ON public.store_settings
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

ALTER TABLE public.store_settings FORCE ROW LEVEL SECURITY;

GRANT SELECT, UPDATE ON public.store_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.store_settings TO service_role;

INSERT INTO public.store_settings (id) VALUES (TRUE) ON CONFLICT (id) DO NOTHING;

-- ===========================================================================
-- 2. email_logs (audit trail for report emails)
-- ===========================================================================

CREATE TYPE public.email_report_type AS ENUM ('daily', 'weekly', 'manual');
CREATE TYPE public.email_log_status AS ENUM ('pending', 'sent', 'failed');

CREATE TABLE IF NOT EXISTS public.email_logs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email     text NOT NULL,
  report_type         public.email_report_type NOT NULL,
  subject             text NOT NULL,
  status              public.email_log_status NOT NULL DEFAULT 'pending',
  ai_summary          text,
  provider_message_id text,
  source              text NOT NULL DEFAULT 'admin' CHECK (source IN ('cron', 'admin', 'ai')),
  risk_level          text NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high')),
  error_message       text,
  requested_by        uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  sent_at             timestamptz,
  updated_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.email_logs IS
  'Audit trail for every business report email (daily/weekly/manual). Fail-closed: a send that fails is recorded as failed with error_message so the Admin UI can surface it. Never stores API keys or secrets.';

COMMENT ON COLUMN public.email_logs.ai_summary IS
  'The AI-generated business insight included in the email. Null when the AI insight could not be produced (which fails the send).';

CREATE OR REPLACE FUNCTION public.set_email_logs_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_email_logs_updated_at ON public.email_logs;
CREATE TRIGGER trg_email_logs_updated_at
  BEFORE UPDATE ON public.email_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_email_logs_updated_at();

CREATE INDEX IF NOT EXISTS idx_email_logs_created_at
  ON public.email_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_status
  ON public.email_logs (status);
CREATE INDEX IF NOT EXISTS idx_email_logs_report_type
  ON public.email_logs (report_type);

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read email logs" ON public.email_logs;
CREATE POLICY "Admins can read email logs"
  ON public.email_logs
  FOR SELECT
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage email logs" ON public.email_logs;
CREATE POLICY "Admins can manage email logs"
  ON public.email_logs
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

ALTER TABLE public.email_logs FORCE ROW LEVEL SECURITY;

GRANT SELECT, UPDATE ON public.email_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.email_logs TO service_role;
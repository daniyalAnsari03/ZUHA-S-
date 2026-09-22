-- Phase 8 — Email automation: monthly report + duplicate-send protection.
--
-- Extends migration 00021:
--   1. Adds 'monthly' to the email_report_type enum so the reporting engine
--      can emit a calendar-month (PKT) report alongside daily/weekly.
--   2. Adds email_logs.period_key — a stable identity for the report PERIOD a
--      row belongs to (daily → YYYY-MM-DD, weekly → window start YYYY-MM-DD,
--      monthly → YYYY-MM). The engine computes it before sending so retries or
--      overlapping cron runs of the same period can (and must) be recognised.
--   3. Adds a partial UNIQUE index on (report_type, period_key) for rows that
--      are 'pending' or 'sent' AND were produced by the automated cron engine
--      (source = 'cron'). This is the hard, race-safe backstop for the
--      app-level idempotency check: if a cron run is triggered twice for the
--      same report period (retry, overlap, concurrent invocation), the second
--      attempt fails its insert instead of sending a duplicate email.
--
-- The constraint deliberately covers ONLY cron rows: an explicit Admin or AI
-- send of the same period is still allowed (the owner asked for a report), and
-- a previously FAILED cron run is not blocked — a failed row keeps status
-- 'failed', so a later retry of the same period can create a fresh row.
--
-- No secrets are stored here. Existing row-level security on email_logs is
-- untouched.

-- ---------------------------------------------------------------------------
-- 1. Extend the report type enum.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'monthly'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'email_report_type')
  ) THEN
    ALTER TYPE public.email_report_type ADD VALUE IF NOT EXISTS 'monthly';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. period_key column on email_logs.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'email_logs' AND column_name = 'period_key'
  ) THEN
    ALTER TABLE public.email_logs ADD COLUMN period_key text;
  END IF;
END $$;

COMMENT ON COLUMN public.email_logs.period_key IS
  'Stable identity of the report period this row belongs to (daily → YYYY-MM-DD in PKT, weekly → window start YYYY-MM-DD, monthly → YYYY-MM). Populated by the engine before sending so duplicate cron runs of the same period can be detected.';

-- ---------------------------------------------------------------------------
-- 3. Duplicate-send protection for the automated cron engine (race-safe).
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS idx_email_logs_cron_period_unique;
CREATE UNIQUE INDEX idx_email_logs_cron_period_unique
  ON public.email_logs (report_type, period_key)
  WHERE status IN ('pending', 'sent') AND source = 'cron';

COMMENT ON INDEX public.idx_email_logs_cron_period_unique IS
  'Blocks a second pending/sent cron run for the same report period. A failed run is not included, so a retry of the same period is allowed. Admin/AI sends are not covered.';
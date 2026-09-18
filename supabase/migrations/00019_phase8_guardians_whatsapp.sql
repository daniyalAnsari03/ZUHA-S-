-- Phase 8 — Guardians & WhatsApp.
--
-- Adds durable storage for the Guardian security layer and the WhatsApp Cloud
-- API integration:
--   guardian_decisions      — pre-execution security decisions for AI actions
--                             (ALLOW / DENY / REQUIRE_APPROVAL), fail-closed.
--   approval_requests       — human approval workflow for high-risk actions.
--   whatsapp_settings       — safe (non-secret) provider connection identity.
--   whatsapp_recipients     — trusted authorized recipients (targets for AI
--                             WhatsApp actions; the AI can never send to an
--                             arbitrary number).
--   whatsapp_messages       — outbound message log + provider status, keyed by
--                             a server-generated idempotency key.
--   whatsapp_webhook_events — inbound webhook event log; unique
--                             provider_event_id prevents duplicate processing.
--
-- SECURITY MODEL:
--   * No secrets are ever stored in the database. WhatsApp access token, app
--     secret and verify token live only in server environment variables.
--   * All Phase 8 server writes use the service-role client (which bypasses
--     RLS by design) behind application-level authorization checks.
--   * All Phase 8 tables are admin-read-only via RLS (public.is_admin).
--   * The `anon` role has no grants on any Phase 8 table.
--   * guardian_decisions.approval_id references approval_requests without a
--     hard foreign key to avoid a circular FK (approval_requests →
--     guardian_decisions). Integrity is enforced by the application layer.

-- ===========================================================================
-- 1. guardian_decisions
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.guardian_decisions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  actor_role        text NOT NULL DEFAULT 'guest'
                    CHECK (actor_role IN ('admin', 'customer', 'guest')),
  agent_name        text NOT NULL,
  tool_name         text,
  action_type       text NOT NULL,
  risk              text NOT NULL CHECK (risk IN ('low', 'medium', 'high')),
  decision          text NOT NULL
                    CHECK (decision IN ('allow', 'deny', 'require_approval')),
  reason            text,
  target_type       text,
  target_id         text,
  args              jsonb NOT NULL DEFAULT '{}',
  approval_required boolean NOT NULL DEFAULT false,
  approval_id       uuid,
  execution_status  text NOT NULL DEFAULT 'pending' CHECK (
                      execution_status IN
                      ('pending', 'approved_pending', 'executed', 'blocked', 'failed', 'skipped')
                    ),
  executed_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.guardian_decisions IS
  'Pre-execution security decisions made by the Guardian layer for AI actions. Append-only decisions with an execution lifecycle; never stores secrets or raw message payloads.';

COMMENT ON COLUMN public.guardian_decisions.args IS
  'Sanitized argument summary only. Must never contain tokens, keys, passwords or full message content.';

CREATE INDEX IF NOT EXISTS idx_guardian_decisions_created_at
  ON public.guardian_decisions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_guardian_decisions_user_id
  ON public.guardian_decisions (user_id);
CREATE INDEX IF NOT EXISTS idx_guardian_decisions_decision
  ON public.guardian_decisions (decision);
CREATE INDEX IF NOT EXISTS idx_guardian_decisions_execution_status
  ON public.guardian_decisions (execution_status);

ALTER TABLE public.guardian_decisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read guardian decisions" ON public.guardian_decisions;
CREATE POLICY "Admins can read guardian decisions"
  ON public.guardian_decisions
  FOR SELECT
  USING (public.is_admin(auth.uid()));

ALTER TABLE public.guardian_decisions FORCE ROW LEVEL SECURITY;

GRANT SELECT ON public.guardian_decisions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.guardian_decisions TO service_role;

-- ===========================================================================
-- 2. approval_requests
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.approval_requests (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_decision_id uuid REFERENCES public.guardian_decisions (id)
                       ON DELETE SET NULL,
  user_id              uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  agent_name           text NOT NULL,
  action_type          text NOT NULL,
  risk                 text NOT NULL CHECK (risk IN ('low', 'medium', 'high')),
  target_type          text,
  target_id            text,
  summary              text NOT NULL,
  execution            jsonb NOT NULL DEFAULT '{}',
  context_hash         text NOT NULL,
  status               text NOT NULL DEFAULT 'pending' CHECK (
                         status IN ('pending', 'approved', 'rejected', 'expired', 'cancelled')
                       ),
  requested_at         timestamptz NOT NULL DEFAULT now(),
  decided_by           uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  decided_at           timestamptz,
  expires_at           timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

COMMENT ON TABLE public.approval_requests IS
  'Human approval workflow for high-risk AI actions. Status is pending/approved/rejected/expired/cancelled. The Guardian re-validates context_hash + expiry before an approved action may execute.';

COMMENT ON COLUMN public.approval_requests.execution IS
  'Safe, admin-only execution payload describing the approved action (e.g. target recipient + content). Never stores credentials or tokens.';

CREATE INDEX IF NOT EXISTS idx_approval_requests_status
  ON public.approval_requests (status);
CREATE INDEX IF NOT EXISTS idx_approval_requests_created_at
  ON public.approval_requests (requested_at DESC);

ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read approval requests" ON public.approval_requests;
CREATE POLICY "Admins can read approval requests"
  ON public.approval_requests
  FOR SELECT
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage approval requests" ON public.approval_requests;
CREATE POLICY "Admins can manage approval requests"
  ON public.approval_requests
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

ALTER TABLE public.approval_requests FORCE ROW LEVEL SECURITY;

GRANT SELECT, UPDATE ON public.approval_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.approval_requests TO service_role;

-- ===========================================================================
-- 3. whatsapp_settings (single-row safe identity config)
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.whatsapp_settings (
  id                        boolean PRIMARY KEY DEFAULT true,
  phone_number_id           text,
  display_phone             text,
  business_name             text,
  require_approval_for_send boolean NOT NULL DEFAULT true,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_settings_single_row CHECK (id)
);

COMMENT ON TABLE public.whatsapp_settings IS
  'Safe display/configuration identity for the WhatsApp Cloud API connection. Never stores the access token, app secret or verify token (those live in server env vars). Enforced single row (id = TRUE).';

COMMENT ON COLUMN public.whatsapp_settings.require_approval_for_send IS
  'When TRUE, outbound WhatsApp messages requested by the AI require an explicit human approval before the provider is contacted.';

ALTER TABLE public.whatsapp_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read whatsapp settings" ON public.whatsapp_settings;
CREATE POLICY "Admins can read whatsapp settings"
  ON public.whatsapp_settings
  FOR SELECT
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage whatsapp settings" ON public.whatsapp_settings;
CREATE POLICY "Admins can manage whatsapp settings"
  ON public.whatsapp_settings
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

ALTER TABLE public.whatsapp_settings FORCE ROW LEVEL SECURITY;

GRANT SELECT, UPDATE ON public.whatsapp_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.whatsapp_settings TO service_role;

INSERT INTO public.whatsapp_settings (id) VALUES (TRUE) ON CONFLICT (id) DO NOTHING;

-- ===========================================================================
-- 4. whatsapp_recipients (approved/trusted recipients)
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.whatsapp_recipients (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label          text NOT NULL,
  phone          text NOT NULL UNIQUE,
  recipient_type text NOT NULL DEFAULT 'admin'
                 CHECK (recipient_type IN ('admin', 'customer')),
  user_id        uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.whatsapp_recipients IS
  'Trusted application-defined recipients. AI WhatsApp actions may ONLY route to approved recipients; arbitrary numbers supplied by the AI are rejected.';

CREATE INDEX IF NOT EXISTS idx_whatsapp_recipients_active
  ON public.whatsapp_recipients (is_active);

ALTER TABLE public.whatsapp_recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read whatsapp recipients" ON public.whatsapp_recipients;
CREATE POLICY "Admins can read whatsapp recipients"
  ON public.whatsapp_recipients
  FOR SELECT
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage whatsapp recipients" ON public.whatsapp_recipients;
CREATE POLICY "Admins can manage whatsapp recipients"
  ON public.whatsapp_recipients
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

ALTER TABLE public.whatsapp_recipients FORCE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_recipients TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_recipients TO service_role;

-- ===========================================================================
-- 5. whatsapp_messages (outbound log + provider status)
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key      text NOT NULL UNIQUE,
  provider_message_id  text UNIQUE,
  recipient_phone      text NOT NULL,
  recipient_label      text,
  content              text NOT NULL,
  message_type         text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text')),
  direction            text NOT NULL DEFAULT 'outbound'
                       CHECK (direction IN ('inbound', 'outbound')),
  sender_phone         text,
  status               text NOT NULL DEFAULT 'queued' CHECK (
                         status IN ('queued', 'sent', 'delivered', 'read', 'failed', 'rejected')
                       ),
  provider_status      text,
  error_code           text,
  error_message        text,
  requested_by_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  guardian_decision_id uuid REFERENCES public.guardian_decisions (id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  sent_at              timestamptz,
  updated_at           timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.whatsapp_messages IS
  'Message log for WhatsApp traffic. Outbound sends are idempotent via idempotency_key; provider status transitions are recorded here. Logs business message text (admin-only read) but never credentials.';

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_status
  ON public.whatsapp_messages (status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_created_at
  ON public.whatsapp_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_recipient
  ON public.whatsapp_messages (recipient_phone);

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read whatsapp messages" ON public.whatsapp_messages;
CREATE POLICY "Admins can read whatsapp messages"
  ON public.whatsapp_messages
  FOR SELECT
  USING (public.is_admin(auth.uid()));

ALTER TABLE public.whatsapp_messages FORCE ROW LEVEL SECURITY;

GRANT SELECT ON public.whatsapp_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.whatsapp_messages TO service_role;

-- ===========================================================================
-- 6. whatsapp_webhook_events (inbound log + idempotency)
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.whatsapp_webhook_events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_event_id text NOT NULL UNIQUE,
  event_type        text NOT NULL DEFAULT 'unknown' CHECK (
                      event_type IN ('message', 'status', 'unknown')
                    ),
  status            text NOT NULL DEFAULT 'received' CHECK (
                      status IN ('received', 'processed', 'ignored', 'failed', 'duplicate')
                    ),
  phone_number_id   text,
  sender_phone      text,
  payload           jsonb NOT NULL DEFAULT '{}',
  error_message     text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  processed_at      timestamptz
);

COMMENT ON TABLE public.whatsapp_webhook_events IS
  'Inbound WhatsApp/webhook event journal. The unique provider_event_id enforces idempotency so retried webhooks never trigger duplicate processing, orders or replies.';

CREATE INDEX IF NOT EXISTS idx_whatsapp_webhook_events_created
  ON public.whatsapp_webhook_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_webhook_events_status
  ON public.whatsapp_webhook_events (status);

ALTER TABLE public.whatsapp_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read whatsapp webhook events" ON public.whatsapp_webhook_events;
CREATE POLICY "Admins can read whatsapp webhook events"
  ON public.whatsapp_webhook_events
  FOR SELECT
  USING (public.is_admin(auth.uid()));

ALTER TABLE public.whatsapp_webhook_events FORCE ROW LEVEL SECURITY;

GRANT SELECT ON public.whatsapp_webhook_events TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.whatsapp_webhook_events TO service_role;
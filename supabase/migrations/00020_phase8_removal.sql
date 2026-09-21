-- Phase 8 removal — Guardians & WhatsApp.
--
-- Reverts migration 00019. Drops every table the Phase 8 Guardian/approval
-- system and Meta WhatsApp Cloud API integration created:
--   whatsapp_messages       — outbound message log + provider status
--   whatsapp_webhook_events — inbound webhook event journal
--   whatsapp_recipients     — approved/trusted recipients
--   whatsapp_settings       — safe non-secret provider identity row
--   approval_requests       — human approval workflow for high-risk actions
--   guardian_decisions      — pre-execution security decisions (fail-closed)
--
-- Tables from earlier migrations (Phase 1–7) are NOT touched. Nothing here
-- stores or exposes secrets: dropping these tables removes no credentials
-- (WhatsApp tokens/keys only ever lived in server environment variables).
--
-- Order matters: child tables with FKs into guardian_decisions are dropped
-- before their parent so no referencing FK remains when guardian_decisions
-- is dropped.

-- 1. whatsapp_messages (references guardian_decisions)
DROP TABLE IF EXISTS public.whatsapp_messages;

-- 2. whatsapp_webhook_events
DROP TABLE IF EXISTS public.whatsapp_webhook_events;

-- 3. whatsapp_recipients
DROP TABLE IF EXISTS public.whatsapp_recipients;

-- 4. whatsapp_settings
DROP TABLE IF EXISTS public.whatsapp_settings;

-- 5. approval_requests (references guardian_decisions)
DROP TABLE IF EXISTS public.approval_requests;

-- 6. guardian_decisions
DROP TABLE IF EXISTS public.guardian_decisions;
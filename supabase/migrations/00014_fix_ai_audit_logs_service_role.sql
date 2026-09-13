-- Fix: grant the `service_role` (admin server client) SELECT on ai_audit_logs.
--
-- Root cause: the AI audit-log list endpoint
--   GET /api/ai/audit-logs
-- uses the service-role admin client (lib/supabase/admin.ts → service_role)
-- to read audit rows. Migration 00013_phase7_ai.sql only granted SELECT to
-- `authenticated`, so the service-role client was denied with SQLSTATE 42501:
--   "permission denied for table ai_audit_logs"
--
-- `service_role` intentionally bypasses RLS (it is the trusted server client
-- used only behind application-level authorization in services/). This grant
-- restores that role's expected read access WITHOUT touching RLS policies.

-- AI audit logs (Phase 7).
-- service_role needs SELECT so the server-side audit service can list logs.
grant select on public.ai_audit_logs to service_role;

-- ai_conversations and ai_messages also need service_role access for the
-- server-side chat service to persist and load messages across requests.
grant select, insert, update on public.ai_conversations to service_role;
grant select, insert on public.ai_messages to service_role;

-- Fix: grant the `service_role` (admin server client) INSERT on ai_audit_logs.
--
-- Root cause: the AI audit writer (services/ai/audit-service.ts →
-- writeAiAuditLog) uses the service-role admin client to append sanitized
-- rows for every AI tool action. Migration 00014 granted service_role only
-- SELECT on ai_audit_logs, so every audit insert failed with SQLSTATE 42501:
--   "permission denied for table ai_audit_logs"
-- (visible in the server log as `[ai-audit] insert failed`).
--
-- `service_role` intentionally bypasses RLS (it is the trusted server client
-- used only behind application-level authorization in services/). This grant
-- restores the role's expected write access WITHOUT touching RLS policies.
-- The table is append-only: no UPDATE/DELETE grant is needed.

grant insert on public.ai_audit_logs to service_role;
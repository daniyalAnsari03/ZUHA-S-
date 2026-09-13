-- Fix: 42501 permission denied for table profiles.
--
-- ROOT CAUSE:
-- Migration 00001 creates the profiles table with RLS policies but never
-- grants any table-level DML privileges to the `authenticated` role.
-- Migration 00003 grants privileges on categories and products but omits
-- profiles. PostgreSQL evaluates table-level privileges BEFORE RLS policies,
-- so the authenticated role is denied at the grant level regardless of RLS.
--
-- FIX:
-- Grant the minimum required privileges (SELECT, UPDATE) to `authenticated`
-- so that existing RLS policies can govern row-level access.
--
-- SECURITY:
-- - RLS remains ENABLED on profiles.
-- - Existing policies (profiles_select_own, profiles_select_admin,
--   profiles_update_own) are NOT modified.
-- - Only SELECT and UPDATE are granted — no INSERT, DELETE, TRUNCATE, etc.
-- - handle_new_user() runs as SECURITY DEFINER, so it does not need
--   table-level INSERT grants for the authenticated role.
-- - get_profile_role() and is_admin() run as SECURITY DEFINER.

-- ---------------------------------------------------------------------------
-- 1. Grant minimum required table privileges
-- ---------------------------------------------------------------------------

grant select, update on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Verify (informational comment — actual verification via \dp or query)
-- ---------------------------------------------------------------------------
-- Expected result for authenticated:
--   SELECT → granted
--   UPDATE → granted
--   INSERT → not granted
--   DELETE → not granted
--
-- RLS should remain ENABLED.
-- Existing policies should be unchanged.

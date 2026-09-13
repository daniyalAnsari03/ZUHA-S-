-- Fix: infinite recursion in profiles_update_own RLS policy (42P17).
--
-- ROOT CAUSE:
-- Migration 00001 created "profiles_update_own" with this WITH CHECK clause:
--   role = (select role from public.profiles where id = (select auth.uid()))
-- This queries `profiles` from within a policy ON `profiles`, causing PostgreSQL
-- to re-evaluate the policy → query profiles again → re-evaluate → infinite loop.
--
-- Migration 00005 fixed profiles_select_admin but missed this update policy.
--
-- FIX:
-- 1. Create a SECURITY DEFINER helper `public.get_profile_role(uuid)` that reads
--    the role from profiles using the function owner's privileges (bypassing RLS).
-- 2. Use this helper in the WITH CHECK clause to prevent recursion.
--
-- SECURITY:
-- - RLS remains ENABLED on profiles.
-- - Customer ownership is preserved (USING clause).
-- - Customers cannot elevate their own role (WITH CHECK clause).
-- - Customers cannot update other users' profiles.
-- - Admin policy (profiles_select_admin) already uses public.is_admin().

-- ---------------------------------------------------------------------------
-- 1. Create safe role-read helper function
-- ---------------------------------------------------------------------------

create or replace function public.get_profile_role(uid uuid)
returns text
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_role text;
begin
  select role into v_role
  from public.profiles
  where id = uid;
  return coalesce(v_role, 'customer');
end;
$$;

comment on function public.get_profile_role(uuid) is
  'Returns the role for a given user. SECURITY DEFINER to avoid RLS recursion on profiles.';

grant execute on function public.get_profile_role(uuid) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- 2. Drop the recursive profiles_update_own policy
-- ---------------------------------------------------------------------------

drop policy if exists "profiles_update_own" on public.profiles;

-- ---------------------------------------------------------------------------
-- 3. Recreate without recursion
-- ---------------------------------------------------------------------------

-- The USING clause ensures the user can only UPDATE their own row.
-- The WITH CHECK clause uses the SECURITY DEFINER helper to read the current
-- role without triggering RLS recursion on profiles.
create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check (
    (select auth.uid()) = id
    and role = public.get_profile_role((select auth.uid()))
  );

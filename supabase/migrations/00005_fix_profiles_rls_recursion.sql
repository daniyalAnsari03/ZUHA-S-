-- Fix: infinite recursion in profiles RLS policy (42P17).
--
-- ROOT CAUSE:
-- The "profiles_select_admin" policy contains:
--   exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin')
-- This queries `profiles` from within a policy ON `profiles`, causing PostgreSQL
-- to re-evaluate the policy → query profiles again → re-evaluate → infinite loop.
--
-- The same recursive pattern appears in categories_admin_all, products_admin_all,
-- and storage_objects_admin_all policies.
--
-- FIX:
-- 1. Create a SECURITY DEFINER function `public.is_admin(uuid)` that reads the
--    role directly from profiles using the function owner's privileges (bypassing RLS).
-- 2. Replace all recursive `exists (select 1 from profiles ...)` checks with
--    `public.is_admin(...)`.
--
-- SECURITY:
-- - RLS remains ENABLED on all tables.
-- - The function is SECURITY DEFINER with a fixed search_path, so it reads
--   profiles with the definer's privileges (bypassing RLS) but cannot be
--   abused by arbitrary SQL injection since it only accepts a uuid argument.
-- - Customer ownership checks are preserved.
-- - No service-role credentials are exposed.
-- - No broad public/cart access is added.

-- ---------------------------------------------------------------------------
-- 1. Create safe admin-check helper function
-- ---------------------------------------------------------------------------

create or replace function public.is_admin(uid uuid)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  is_admin_user boolean;
begin
  select (role = 'admin') into is_admin_user
  from public.profiles
  where id = uid;
  return coalesce(is_admin_user, false);
end;
$$;

comment on function public.is_admin(uuid) is
  'Returns true if the given user has admin role. SECURITY DEFINER to avoid RLS recursion on profiles.';

-- Grant execute to authenticated (and anon for completeness; the function
-- returns false for non-admin users regardless).
grant execute on function public.is_admin(uuid) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- 2. Fix profiles_select_admin — the direct recursion source
-- ---------------------------------------------------------------------------

drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin"
  on public.profiles
  for select
  to authenticated
  using (public.is_admin((select auth.uid())));

-- ---------------------------------------------------------------------------
-- 3. Fix categories_admin_all — queries profiles recursively
-- ---------------------------------------------------------------------------

drop policy if exists "categories_admin_all" on public.categories;
create policy "categories_admin_all"
  on public.categories
  for all
  to authenticated
  using (public.is_admin((select auth.uid())));

-- ---------------------------------------------------------------------------
-- 4. Fix products_admin_all — queries profiles recursively
-- ---------------------------------------------------------------------------

drop policy if exists "products_admin_all" on public.products;
create policy "products_admin_all"
  on public.products
  for all
  to authenticated
  using (public.is_admin((select auth.uid())));

-- ---------------------------------------------------------------------------
-- 5. Fix storage_objects_admin_all — queries profiles recursively
-- ---------------------------------------------------------------------------

drop policy if exists "storage_objects_admin_all" on storage.objects;
create policy "storage_objects_admin_all"
  on storage.objects
  for all
  to authenticated
  using (
    bucket_id = 'product-images'
    and public.is_admin((select auth.uid()))
  );

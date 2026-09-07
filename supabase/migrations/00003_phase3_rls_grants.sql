-- Phase 3 fix: grant table-level DML privileges to supabase roles.
-- The Phase 3 tables exist but the default Supabase migration flow applied
-- create/alter statements WITHOUT the standard role grants, so public reads
-- and authenticated admin operations were denied at the grant level before
-- RLS policies were ever evaluated. RLS policies narrow these grants.

grant select on public.categories to anon, authenticated;
grant insert, update, delete on public.categories to authenticated;

grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;
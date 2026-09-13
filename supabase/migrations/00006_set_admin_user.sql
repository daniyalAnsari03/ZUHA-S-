-- Set the store administrator role for the primary business owner.
--
-- This migration promotes dinsbydaniyal@gmail.com to admin role so they can
-- access the Admin Dashboard through the normal /login flow.
--
-- SECURITY:
-- - Only targets a single specific email address.
-- - Does NOT weaken RLS or authentication.
-- - Does NOT expose any credentials.
-- - The handle_new_user() trigger ensures a profile row exists.
-- - Uses upsert to be idempotent (safe to re-run).

-- Promote the primary admin user
insert into public.profiles (id, role)
select id, 'admin'
from auth.users
where email = 'dinsbydaniyal@gmail.com'
on conflict (id) do update
  set role = 'admin',
      updated_at = now()
  where public.profiles.role != 'admin';

-- Verify: raise a notice if the user was found and promoted
do $$
begin
  if exists (
    select 1 from auth.users u
    join public.profiles p on p.id = u.id
    where u.email = 'dinsbydaniyal@gmail.com' and p.role = 'admin'
  ) then
    raise notice 'Admin role set for dinsbydaniyal@gmail.com';
  else
    raise notice 'User dinsbydaniyal@gmail.com not found in auth.users — create the account first via /signup, then re-run this migration.';
  end if;
end
$$;

-- Fix admin role for dinsbydaniyal@gmail.com.
--
-- Migration 00006 was designed to promote this user to admin, but if the user
-- was created AFTER 00006 ran, the profile row was created by the
-- handle_new_user() trigger with the default 'customer' role.
--
-- This migration is idempotent and safe to re-run.

-- Promote the primary admin user (idempotent upsert)
insert into public.profiles (id, role)
select id, 'admin'
from auth.users
where email = 'dinsbydaniyal@gmail.com'
on conflict (id) do update
  set role = 'admin',
      updated_at = now()
  where public.profiles.role != 'admin';

-- Verification notices
do $$
declare
  v_profile record;
begin
  select p.id, p.role, p.created_at, p.updated_at
  into v_profile
  from auth.users u
  join public.profiles p on p.id = u.id
  where u.email = 'dinsbydaniyal@gmail.com';

  if not found then
    raise notice 'DIAGNOSTIC: No profile found for dinsbydaniyal@gmail.com — user may not exist in auth.users yet.';
  else
    raise notice 'DIAGNOSTIC: Profile for dinsbydaniyal@gmail.com — id: %, role: %, updated_at: %',
      v_profile.id, v_profile.role, v_profile.updated_at;

    if v_profile.role != 'admin' then
      raise warning 'UNEXPECTED: Profile role is still % after upsert. Investigate RLS or trigger issues.', v_profile.role;
    else
      raise notice 'VERIFICATION: Profile role is admin. Admin access should now work.';
    end if;
  end if;
end
$$;

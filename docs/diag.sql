-- Diagnostic: simulate what getAuthUser does with RLS
-- This tests whether the RLS policies allow the profile query to succeed

-- 1. Check all policies on profiles
SELECT policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'profiles';

-- 2. Verify the is_admin function works for our user
SELECT public.is_admin('5a6f3d41-d8d9-4321-ba39-e18dbc1500f3') AS is_admin_result;

-- 3. Check the profile row directly (service role, no RLS)
SELECT id, role, created_at, updated_at
FROM public.profiles
WHERE id = '5a6f3d41-d8d9-4321-ba39-e18dbc1500f3';

-- 4. Check if handle_new_user trigger exists and is enabled
SELECT tgname, tgenabled, tgtype::bit(16) AS tgtype
FROM pg_trigger
WHERE tgname = 'on_auth_user_created';

-- 5. Check what happens if trigger fires again (simulate re-signup)
-- This should do nothing due to ON CONFLICT DO NOTHING
-- But let's verify the trigger function handles it correctly
SELECT prosrc FROM pg_proc WHERE proname = 'handle_new_user';

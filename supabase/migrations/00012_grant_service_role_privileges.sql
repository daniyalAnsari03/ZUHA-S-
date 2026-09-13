-- Fix: grant the `service_role` (admin server client) privileges on public
-- business tables.
--
-- Root cause: checkout's stock verification failed with
--   "permission denied for table products" (SQLSTATE 42501)
-- because every migration only granted privileges to `anon`/`authenticated`
-- and never to `service_role`. The trusted server-side client
-- (lib/supabase/admin.ts) runs as `service_role`, so its SELECT on
-- `products` — the first access in the checkout flow — was denied, surfacing
-- as "Failed to verify stock. Please try again."
--
-- `service_role` intentionally bypasses RLS (it is the trusted server client
-- used only behind application-level authorization in services/). These
-- grants restore that role's expected access WITHOUT touching RLS policies.

-- Products & categories (Phase 3 storefront tables).
grant select, insert, update, delete on public.products to service_role;
grant select, insert, update, delete on public.categories to service_role;

-- Profiles (Phase 1, used for admin lookup by the notification service).
grant select, insert, update on public.profiles to service_role;

-- Cart & wishlist (Phase 4).
grant select, insert, update, delete on public.carts to service_role;
grant select, insert, update, delete on public.cart_items to service_role;
grant select, insert, update, delete on public.wishlists to service_role;
grant select, insert, update, delete on public.wishlist_items to service_role;

-- Orders (Phase 5).
grant select, insert, update, delete on public.orders to service_role;
grant select, insert, update, delete on public.order_items to service_role;
grant select, insert, update, delete on public.order_status_history to service_role;
grant select, insert, update, delete on public.notifications to service_role;

-- CMS content (Phase 2 homepage sections etc.).
grant select, insert, update, delete on public.site_content to service_role;

-- Order number generator RPC used by the admin client.
grant execute on function public.generate_order_number() to service_role;
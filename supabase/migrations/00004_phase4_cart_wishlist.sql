-- Phase 4: Cart, Wishlist & Checkout foundation.
-- Establishes secure, RLS-protected carts, cart_items, wishlists and
-- wishlist_items backed by authenticated Supabase users. Business-critical
-- data (price, stock) continues to live only on `products`.

-- ---------------------------------------------------------------------------
-- carts
-- ---------------------------------------------------------------------------

create table if not exists public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'converted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.carts is
  'One active cart per authenticated customer. Business-critical pricing/stock never live here.';

-- Enforce a single active cart per user.
create unique index if not exists carts_single_active_per_user
  on public.carts (user_id) where (status = 'active');

create index if not exists carts_user_id_idx on public.carts (user_id);

drop trigger if exists carts_set_updated_at on public.carts;
create trigger carts_set_updated_at
  before update on public.carts
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- cart_items
-- ---------------------------------------------------------------------------

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.cart_items is
  'Line items belonging to a cart. Quantity must stay > 0; price is always read live from products.';

-- One line per product per cart.
create unique index if not exists cart_items_unique_product
  on public.cart_items (cart_id, product_id);

create index if not exists cart_items_cart_id_idx on public.cart_items (cart_id);
create index if not exists cart_items_product_id_idx on public.cart_items (product_id);

drop trigger if exists cart_items_set_updated_at on public.cart_items;
create trigger cart_items_set_updated_at
  before update on public.cart_items
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- wishlists
-- ---------------------------------------------------------------------------

create table if not exists public.wishlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.wishlists is
  'One wishlist per authenticated customer.';

create unique index if not exists wishlists_one_per_user on public.wishlists (user_id);

create index if not exists wishlists_user_id_idx on public.wishlists (user_id);

drop trigger if exists wishlists_set_updated_at on public.wishlists;
create trigger wishlists_set_updated_at
  before update on public.wishlists
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- wishlist_items
-- ---------------------------------------------------------------------------

create table if not exists public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  wishlist_id uuid not null references public.wishlists (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.wishlist_items is
  'Products saved to a wishlist. A product cannot appear twice in one wishlist.';

-- One saved product per wishlist.
create unique index if not exists wishlist_items_unique_product
  on public.wishlist_items (wishlist_id, product_id);

create index if not exists wishlist_items_wishlist_id_idx on public.wishlist_items (wishlist_id);
create index if not exists wishlist_items_product_id_idx on public.wishlist_items (product_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.wishlists enable row level security;
alter table public.wishlist_items enable row level security;

-- Granular table grants (policies narrow what each role may do).
grant select, insert, update, delete on public.carts to authenticated;
grant select, insert, update, delete on public.cart_items to authenticated;
grant select, insert, update, delete on public.wishlists to authenticated;
grant select, insert, update, delete on public.wishlist_items to authenticated;

-- Anonymous (public) users may browse products but must NOT modify any cart
-- or wishlist record. No grants are given to `anon` for these tables.

-- -- carts ---------------------------------------------------------------------
-- Users may read only their own cart.
drop policy if exists "carts_select_own" on public.carts;
create policy "carts_select_own"
  on public.carts
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Users may create only their own cart.
drop policy if exists "carts_insert_own" on public.carts;
create policy "carts_insert_own"
  on public.carts
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

-- Users may update only their own cart.
drop policy if exists "carts_update_own" on public.carts;
create policy "carts_update_own"
  on public.carts
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Users may delete only their own cart.
drop policy if exists "carts_delete_own" on public.carts;
create policy "carts_delete_own"
  on public.carts
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- -- cart_items ----------------------------------------------------------------
-- Users may read items only within their own cart.
drop policy if exists "cart_items_select_own" on public.cart_items;
create policy "cart_items_select_own"
  on public.cart_items
  for select
  to authenticated
  using (
    exists (
      select 1 from public.carts c
      where c.id = cart_id and c.user_id = (select auth.uid())
    )
  );

-- Users may insert items only into their own cart.
drop policy if exists "cart_items_insert_own" on public.cart_items;
create policy "cart_items_insert_own"
  on public.cart_items
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.carts c
      where c.id = cart_id and c.user_id = (select auth.uid())
    )
  );

-- Users may update items only within their own cart.
drop policy if exists "cart_items_update_own" on public.cart_items;
create policy "cart_items_update_own"
  on public.cart_items
  for update
  to authenticated
  using (
    exists (
      select 1 from public.carts c
      where c.id = cart_id and c.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.carts c
      where c.id = cart_id and c.user_id = (select auth.uid())
    )
  );

-- Users may delete items only within their own cart.
drop policy if exists "cart_items_delete_own" on public.cart_items;
create policy "cart_items_delete_own"
  on public.cart_items
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.carts c
      where c.id = cart_id and c.user_id = (select auth.uid())
    )
  );

-- -- wishlists -----------------------------------------------------------------
drop policy if exists "wishlists_select_own" on public.wishlists;
create policy "wishlists_select_own"
  on public.wishlists
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "wishlists_insert_own" on public.wishlists;
create policy "wishlists_insert_own"
  on public.wishlists
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "wishlists_update_own" on public.wishlists;
create policy "wishlists_update_own"
  on public.wishlists
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "wishlists_delete_own" on public.wishlists;
create policy "wishlists_delete_own"
  on public.wishlists
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- -- wishlist_items ------------------------------------------------------------
drop policy if exists "wishlist_items_select_own" on public.wishlist_items;
create policy "wishlist_items_select_own"
  on public.wishlist_items
  for select
  to authenticated
  using (
    exists (
      select 1 from public.wishlists w
      where w.id = wishlist_id and w.user_id = (select auth.uid())
    )
  );

drop policy if exists "wishlist_items_insert_own" on public.wishlist_items;
create policy "wishlist_items_insert_own"
  on public.wishlist_items
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.wishlists w
      where w.id = wishlist_id and w.user_id = (select auth.uid())
    )
  );

drop policy if exists "wishlist_items_update_own" on public.wishlist_items;
create policy "wishlist_items_update_own"
  on public.wishlist_items
  for update
  to authenticated
  using (
    exists (
      select 1 from public.wishlists w
      where w.id = wishlist_id and w.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.wishlists w
      where w.id = wishlist_id and w.user_id = (select auth.uid())
    )
  );

drop policy if exists "wishlist_items_delete_own" on public.wishlist_items;
create policy "wishlist_items_delete_own"
  on public.wishlist_items
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.wishlists w
      where w.id = wishlist_id and w.user_id = (select auth.uid())
    )
  );

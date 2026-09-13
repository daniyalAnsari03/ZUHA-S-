-- Phase 5: Orders, Order Items, Order Status History & Notifications.
--
-- This migration建立 the order system foundation for the e-commerce platform.
-- It depends on:
--   00001: profiles table, set_updated_at(), public.is_admin(uuid)
--   00002: products table
--
-- All objects use IF NOT EXISTS / OR REPLACE for idempotency.
-- RLS uses public.is_admin(uid) (SECURITY DEFINER) to avoid profiles recursion.

-- =========================================================================
-- 1. Extend profiles with customer/shipping fields
-- =========================================================================

alter table public.profiles
  add column if not exists full_name text,
  add column if not exists phone text,
  add column if not exists address text,
  add column if not exists city text,
  add column if not exists postal_code text;

comment on column public.profiles.full_name is 'Customer full name for orders/shipping.';
comment on column public.profiles.phone is 'Customer phone number.';
comment on column public.profiles.address is 'Default shipping address.';
comment on column public.profiles.city is 'Default city.';
comment on column public.profiles.postal_code is 'Default postal code.';

-- =========================================================================
-- 2. Enums
-- =========================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'order_status') then
    create type public.order_status as enum (
      'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'
    );
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'payment_status') then
    create type public.payment_status as enum (
      'pending', 'paid', 'failed', 'refunded'
    );
  end if;
end
$$;

-- =========================================================================
-- 3. orders
-- =========================================================================

create table if not exists public.orders (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete restrict,
  order_number    text not null,
  status          public.order_status not null default 'pending',
  payment_status  public.payment_status not null default 'pending',
  payment_method  text,
  customer_name   text not null,
  customer_phone  text not null,
  customer_email  text not null,
  shipping_address text not null,
  city            text not null,
  postal_code     text,
  subtotal        integer not null,
  shipping_fee    integer not null default 0,
  total           integer not null,
  order_notes     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.orders is
  'Customer orders with snapshot pricing. Never overwrites historical data.';

-- Indexes
create unique index if not exists orders_order_number_idx   on public.orders (order_number);
create index if not exists orders_user_id_idx              on public.orders (user_id);
create index if not exists orders_status_idx               on public.orders (status);
create index if not exists orders_created_at_idx           on public.orders (created_at desc);

-- updated_at trigger
drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
  before update on public.orders
  for each row
  execute function public.set_updated_at();

-- =========================================================================
-- 4. order_items (historical snapshots)
-- =========================================================================

create table if not exists public.order_items (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references public.orders (id) on delete cascade,
  product_id      uuid references public.products (id) on delete set null,
  product_name    text not null,
  product_price   integer not null,
  product_image   text,
  quantity        integer not null check (quantity > 0),
  subtotal        integer not null,
  created_at      timestamptz not null default now()
);

comment on table public.order_items is
  'Snapshot line items for an order. Prices/names are frozen at purchase time.';

create index if not exists order_items_order_id_idx   on public.order_items (order_id);
create index if not exists order_items_product_id_idx on public.order_items (product_id);

-- =========================================================================
-- 5. order_status_history
-- =========================================================================

create table if not exists public.order_status_history (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references public.orders (id) on delete cascade,
  previous_status public.order_status,
  new_status      public.order_status not null,
  note            text,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now()
);

comment on table public.order_status_history is
  'Immutable audit trail of order status changes.';

create index if not exists order_status_history_order_id_idx    on public.order_status_history (order_id);
create index if not exists order_status_history_created_at_idx  on public.order_status_history (created_at desc);

-- =========================================================================
-- 6. notifications
-- =========================================================================

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  order_id   uuid references public.orders (id) on delete set null,
  type       text not null,
  title      text not null,
  message    text not null,
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.notifications is
  'In-app notifications for customers and admins.';

create index if not exists notifications_user_id_idx        on public.notifications (user_id);
create index if not exists notifications_user_unread_idx   on public.notifications (user_id) where (is_read = false);
create index if not exists notifications_created_at_idx    on public.notifications (created_at desc);

-- =========================================================================
-- 7. Order number generator
-- =========================================================================

create or replace function public.generate_order_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_number text;
  v_exists boolean;
begin
  loop
    v_number := 'DIN-' || to_char(now(), 'YYYYMMDD') || '-' ||
                lpad((floor(random() * 9999) + 1)::text, 4, '0');

    select exists(
      select 1 from public.orders where order_number = v_number
    ) into v_exists;

    exit when not v_exists;
  end loop;

  return v_number;
end;
$$;

comment on function public.generate_order_number() is
  'Generates a unique human-readable order number like DIN-20260910-0001.';

grant execute on function public.generate_order_number() to authenticated;

-- =========================================================================
-- 8. Status transition enforcement
-- =========================================================================

create or replace function public.validate_order_status_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allowed text[];
begin
  if old.status = new.status then
    return new;
  end if;

  case old.status::text
    when 'pending'    then v_allowed := ARRAY['confirmed','cancelled'];
    when 'confirmed'  then v_allowed := ARRAY['processing','cancelled'];
    when 'processing' then v_allowed := ARRAY['shipped','cancelled'];
    when 'shipped'    then v_allowed := ARRAY['delivered'];
    when 'delivered'  then v_allowed := ARRAY[]::text[];
    when 'cancelled'  then v_allowed := ARRAY[]::text[];
    else                   v_allowed := ARRAY[]::text[];
  end case;

  if not (new.status::text = any(v_allowed)) then
    raise exception 'Invalid status transition from % to %', old.status, new.status;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_order_status on public.orders;
create trigger validate_order_status
  before update of status on public.orders
  for each row
  execute function public.validate_order_status_transition();

-- =========================================================================
-- 9. RLS
-- =========================================================================

alter table public.orders                enable row level security;
alter table public.order_items           enable row level security;
alter table public.order_status_history  enable row level security;
alter table public.notifications         enable row level security;

-- Grants (RLS policies narrow these)
grant select, insert, update       on public.orders                to authenticated;
grant select, insert               on public.order_items           to authenticated;
grant select, insert               on public.order_status_history  to authenticated;
grant select, insert, update       on public.notifications         to authenticated;

-- --- orders -----------------------------------------------------------------

drop policy if exists "orders_select_own" on public.orders;
create policy "orders_select_own"
  on public.orders for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "orders_insert_own" on public.orders;
create policy "orders_insert_own"
  on public.orders for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "orders_admin_all" on public.orders;
create policy "orders_admin_all"
  on public.orders for all to authenticated
  using (public.is_admin((select auth.uid())));

-- --- order_items -------------------------------------------------------------

drop policy if exists "order_items_select_own" on public.order_items;
create policy "order_items_select_own"
  on public.order_items for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and o.user_id = (select auth.uid())
    )
  );

drop policy if exists "order_items_insert_own" on public.order_items;
create policy "order_items_insert_own"
  on public.order_items for insert to authenticated
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_id and o.user_id = (select auth.uid())
    )
  );

drop policy if exists "order_items_admin_all" on public.order_items;
create policy "order_items_admin_all"
  on public.order_items for all to authenticated
  using (public.is_admin((select auth.uid())));

-- --- order_status_history ----------------------------------------------------

drop policy if exists "order_status_history_select_own" on public.order_status_history;
create policy "order_status_history_select_own"
  on public.order_status_history for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and o.user_id = (select auth.uid())
    )
  );

drop policy if exists "order_status_history_insert_admin" on public.order_status_history;
create policy "order_status_history_insert_admin"
  on public.order_status_history for insert to authenticated
  with check (public.is_admin((select auth.uid())));

drop policy if exists "order_status_history_admin_all" on public.order_status_history;
create policy "order_status_history_admin_all"
  on public.order_status_history for all to authenticated
  using (public.is_admin((select auth.uid())));

-- --- notifications -----------------------------------------------------------

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
  on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "notifications_insert_authenticated" on public.notifications;
create policy "notifications_insert_authenticated"
  on public.notifications for insert to authenticated
  with check (true);

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
  on public.notifications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "notifications_admin_all" on public.notifications;
create policy "notifications_admin_all"
  on public.notifications for all to authenticated
  using (public.is_admin((select auth.uid())));

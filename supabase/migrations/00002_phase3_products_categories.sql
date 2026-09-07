-- Phase 3: Products & Categories.
-- Establishes the `categories` and `products` tables, RLS, indexes and seed
-- data mirroring the Phase 2 catalog so the storefront reads from the real
-- database while preserving the premium UI.

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text null,
  image_url text null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.categories is
  'Storefront categories, e.g. Jamawar, Embroidery, Cut-Dana, Plain, Unstitched, Lawn.';

drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at
  before update on public.categories
  for each row
  execute function public.set_updated_at();

create index if not exists categories_sort_order_idx on public.categories (is_active, sort_order);

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid null references public.categories (id) on delete set null,
  name text not null,
  slug text not null unique,
  description text null,
  fabric text null,
  embroidery text null,
  color text null,
  label text null,
  price numeric(12, 2) not null check (price >= 0),
  compare_at_price numeric(12, 2) null check (compare_at_price >= 0),
  sku text null unique,
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  low_stock_threshold integer not null default 5 check (low_stock_threshold >= 0),
  image_url text null,
  is_active boolean not null default true,
  is_featured boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.products is
  'Storefront products. Business-critical data (price, stock) lives only here.';

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row
  execute function public.set_updated_at();

create index if not exists products_category_id_idx on public.products (category_id);
create index if not exists products_active_idx on public.products (is_active);
create index if not exists products_featured_idx on public.products (is_featured);
create index if not exists products_sort_order_idx on public.products (sort_order, is_active);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.categories enable row level security;
alter table public.products enable row level security;

-- Granular table grants. RLS policies refine what each role may see/do.
--   anon          : public storefront reads (active rows only, via policies)
--   authenticated : customer-scoped reads + admin management (via policies)
grant select on public.categories to anon, authenticated;
grant insert, update, delete on public.categories to authenticated;
grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;

-- Public storefront may read only ACTIVE categories.
drop policy if exists "categories_select_active" on public.categories;
create policy "categories_select_active"
  on public.categories
  for select
  to anon, authenticated
  using (is_active = true);

-- Admins may fully manage categories.
drop policy if exists "categories_admin_all" on public.categories;
create policy "categories_admin_all"
  on public.categories
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'admin'
    )
  );

-- Public storefront may read only ACTIVE products.
drop policy if exists "products_select_active" on public.products;
create policy "products_select_active"
  on public.products
  for select
  to anon, authenticated
  using (is_active = true);

-- Admins may fully manage products.
drop policy if exists "products_admin_all" on public.products;
create policy "products_admin_all"
  on public.products
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'admin'
    )
  );

-- ---------------------------------------------------------------------------
-- Storage: product image bucket
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit)
values ('product-images', 'product-images', true, 5242880)
on conflict (id) do nothing;

-- Anyone may read publicly shared product images.
drop policy if exists "storage_objects_select_public" on storage.objects;
create policy "storage_objects_select_public"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'product-images');

-- Admins may upload/update/delete product images.
drop policy if exists "storage_objects_admin_all" on storage.objects;
create policy "storage_objects_admin_all"
  on storage.objects
  for all
  to authenticated
  using (
    bucket_id = 'product-images'
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'admin'
    )
  );

-- ---------------------------------------------------------------------------
-- Seed: categories
-- ---------------------------------------------------------------------------

insert into public.categories (name, slug, description, image_url, is_active, sort_order)
values
  ('Jamawar', 'jamawar', 'Hand-woven jamawar in the Kashmir tradition.', '/images/placeholders/category-jamawar.svg', true, 1),
  ('Embroidery', 'embroidery', 'Fine threadwork finished by hand.', '/images/placeholders/category-embroidery.svg', true, 2),
  ('Cut-Dana Embroidery', 'cut-dana', 'Sequinned cut-dana with a quiet lustre.', '/images/placeholders/category-cut-dana.svg', true, 3),
  ('Plain', 'plain', 'Clean cuts that let the fabric speak.', '/images/placeholders/category-plain.svg', true, 4),
  ('Unstitched', 'unstitched', 'Signature unstitched three-piece collections.', '/images/placeholders/category-unstitched.svg', true, 5),
  ('Lawn', 'lawn', 'Featherlight lawn made for warmer days.', '/images/placeholders/category-lawn.svg', true, 6)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Seed: products
-- ---------------------------------------------------------------------------

insert into public.products (
  slug, name, description, fabric, embroidery, color, label,
  price, stock_quantity, low_stock_threshold, image_url, is_active, is_featured, sort_order, category_id
)
select
  v.slug, v.name, v.description, v.fabric, v.embroidery, v.color, v.label,
  v.price, v.stock, 5, v.image, true, v.featured, v.sort, c.id
from (
  values
    ('khirke-jamawar', 'Khirke Jamawar', 'Hand-woven jamawar kurta with mirrored khirke motifs.', 'Hand-woven jamawar', 'Woven motif', 'Plum & gold', 'New', 34500, 12, true, 1, '/images/placeholders/product-1.svg', 'jamawar'),
    ('sitara-cut-dana', 'Sitara Cut-Dana', 'Cut-dana kurta scattered with fine star sequins.', 'Cotton silk', 'Cut-dana', 'Deep plum', 'New', 21800, 8, true, 2, '/images/placeholders/product-2.svg', 'cut-dana'),
    ('gulab-thread-tunic', 'Gulab Thread Tunic', 'Resham thread tunic with hand-embroidered rosework.', 'Cotton silk', 'Resham thread', 'Ivory', 'New', 18900, 15, true, 3, '/images/placeholders/product-3.svg', 'embroidery'),
    ('dastaan-unstitched', 'Dastaan Unstitched', 'Unstitched three-piece in soft washed texture.', 'Washed cotton', null, 'Warm ivory', 'New', 12400, 20, true, 4, '/images/placeholders/product-4.svg', 'unstitched'),
    ('bahadur-shahi-jamawar', 'Bahadur Shahi Jamawar', 'Editorial jamawar panel with classic shahi borders.', 'Hand-woven jamawar', 'Woven motif', 'Ivory & gold', null, 38900, 6, true, 5, '/images/placeholders/product-5.svg', 'jamawar'),
    ('mehrab-jamawar', 'Mehrab Jamawar', 'Jamawar kurta with arch-inspired woven panels.', 'Hand-woven jamawar', 'Woven motif', 'Charcoal & gold', null, 32700, 9, true, 6, '/images/placeholders/product-6.svg', 'jamawar'),
    ('sitara-motif-jamawar', 'Sitara Motif Jamawar', 'Small star motifs woven across a fine base.', 'Hand-woven jamawar', 'Woven motif', 'Plum', null, 29900, 10, true, 7, '/images/placeholders/product-2.svg', 'jamawar'),
    ('shalimar-embroidery', 'Shalimar Embroidery', 'Garden-inspired resham embroidery on cotton silk.', 'Cotton silk', 'Resham thread', 'Cream', null, 20500, 11, true, 8, '/images/placeholders/product-6.svg', 'embroidery'),
    ('qand-aab-embroidery', 'Qand Aab Embroidery', 'Delicate drop-stitch embroidery in soft tones.', 'Cotton', 'Drop stitch', 'Sand', null, 17200, 13, true, 9, '/images/placeholders/product-1.svg', 'embroidery'),
    ('dhaga-resham-kurta', 'Dhaga Resham Kurta', 'A minimal kurta elevated by contrast resham work.', 'Cotton silk', 'Resham thread', 'Ivory', null, 19800, 14, true, 10, '/images/placeholders/product-4.svg', 'embroidery'),
    ('chandni-cut-dana', 'Chandni Cut-Dana', 'Moonlit cut-dana motifs on a slim silhouette.', 'Cotton silk', 'Cut-dana', 'Dusty gold', null, 22400, 7, true, 11, '/images/placeholders/product-3.svg', 'cut-dana'),
    ('roshni-cut-dana', 'Roshni Cut-Dana', 'Radiant cut-dana panels with a fine shimmer.', 'Cotton silk', 'Cut-dana', 'Plum', null, 21600, 8, true, 12, '/images/placeholders/product-5.svg', 'cut-dana'),
    ('maah-cut-dana', 'Maah Cut-Dana', 'Subtle crescent cut-dana detail on ivory.', 'Cotton silk', 'Cut-dana', 'Ivory', null, 19900, 12, true, 13, '/images/placeholders/product-6.svg', 'cut-dana'),
    ('sukoon-cotton', 'Sukoon Cotton', 'A perfectly plain cotton kurta in a calm cut.', 'Pure cotton', null, 'Warm white', null, 9900, 30, true, 14, '/images/placeholders/product-4.svg', 'plain'),
    ('saada-kurta', 'Saada Kurta', 'Unlined and unembellished, made for layering.', 'Pure cotton', null, 'Sand', null, 9400, 28, true, 15, '/images/placeholders/product-1.svg', 'plain'),
    ('rihla-cotton', 'Rihla Cotton Ensemble', 'A plain cotton ensemble with a relaxed drape.', 'Cotton', null, 'Cream', null, 11600, 18, true, 16, '/images/placeholders/product-3.svg', 'plain'),
    ('naseem-plain-kurta', 'Naseem Plain Kurta', 'The quiet luxury of fine cotton and clean lines.', 'Cotton', null, 'Ivory', null, 10400, 22, true, 17, '/images/placeholders/product-2.svg', 'plain'),
    ('mitti-unstitched', 'Mitti Unstitched', 'Unstitched three-piece grounded in earthy tones.', 'Washed cotton', null, 'Clay', null, 13100, 9, true, 18, '/images/placeholders/product-5.svg', 'unstitched'),
    ('hira-unstitched', 'Hira Unstitched', 'Unstitched set with fine tonal ruching details.', 'Washed cotton', null, 'Warm ivory', null, 13800, 7, true, 19, '/images/placeholders/product-6.svg', 'unstitched'),
    ('bagh-unstitched', 'Bagh Unstitched', 'An unstitched three-piece cut from soft lawn.', 'Lawn', null, 'Cream', null, 11800, 11, true, 20, '/images/placeholders/product-1.svg', 'unstitched'),
    ('abtiha-lawn', 'Abtiha Lawn', 'Featherlight lawn shirt with a breezy drape.', 'Premium lawn', null, 'Dusty rose', null, 8900, 25, true, 21, '/images/placeholders/product-2.svg', 'lawn'),
    ('subah-lawn', 'Subah Lawn', 'Crisp lawn shirt in a soft morning palette.', 'Premium lawn', null, 'Pale gold', null, 9200, 24, true, 22, '/images/placeholders/product-3.svg', 'lawn'),
    ('raat-ki-rani-lawn', 'Raat Ki Rani Lawn', 'Night-blooming floral on lightweight lawn.', 'Premium lawn', 'Printed floral', 'Ivory', null, 9700, 21, true, 23, '/images/placeholders/product-4.svg', 'lawn'),
    ('bahaur-lawn', 'Bahaur Lawn', 'A fresh spring-weight lawn shirt.', 'Premium lawn', null, 'Cream', null, 8800, 26, true, 24, '/images/placeholders/product-5.svg', 'lawn')
) as v(slug, name, description, fabric, embroidery, color, label, price, stock, featured, sort, image, category_slug)
join public.categories c on c.slug = v.category_slug
on conflict (slug) do nothing;

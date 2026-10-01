-- ---------------------------------------------------------------------------
-- 00024: Mobile-only category image
--
-- The homepage renders one full-bleed slide per category (components/storefront/
-- home-slides.tsx). A single image cannot serve both a landscape desktop/tablet
-- viewport and a portrait phone viewport, so categories get a second, optional
-- image used below 768px.
--
-- Scope is intentionally minimal:
--   * Additive and nullable. public.categories.image_url is untouched and stays
--     the desktop image. No rows are rewritten, no seed data changes.
--   * No RLS change is required — policies are table-scoped, not column-scoped,
--     so the new column is covered by the existing public select / admin all
--     policies from migration 00002 (admin policy re-fixed in 00005).
--   * No new index. The column is never filtered or sorted on; it is read
--     alongside the rest of the row by the existing select('*') queries.
--
-- Idempotent: `if not exists`, so re-running is a no-op.
-- ---------------------------------------------------------------------------

alter table public.categories
  add column if not exists mobile_image_url text null;

comment on column public.categories.image_url is
  'Category slide image used from 768px up (desktop + tablet).';

comment on column public.categories.mobile_image_url is
  'Optional category slide image used below 768px (mobile). Falls back to image_url when null or empty.';

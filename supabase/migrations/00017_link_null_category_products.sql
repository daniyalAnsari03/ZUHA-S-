-- ---------------------------------------------------------------------------
-- 00017: Link products that had a NULL category_id to their correct category
--
-- Bug: The AI admin "phantom product" behavior traced back to seed products
-- whose category_id was NULL. Because the storefront menu/filter derives from
-- category, NULL-category products could surface in unexpected places and gave
-- the model an ambiguous identity to default to. This migration links each
-- known NULL-category seed product to its canonical category.
--
-- Category lookups are slug-based (no hard-coded UUIDs) and every update is
-- guarded by "is distinct from", so the migration is fully idempotent.
-- ---------------------------------------------------------------------------

update public.products p
set category_id = c.id
from public.categories c
where c.slug = 'jamawar'
  and p.slug = 'khirke-jamawar'
  and p.category_id is distinct from c.id;

update public.products p
set category_id = c.id
from public.categories c
where c.slug = 'plain'
  and p.slug in ('sukoon-cotton', 'rihla-cotton', 'naseem-plain-kurta')
  and p.category_id is distinct from c.id;

update public.products p
set category_id = c.id
from public.categories c
where c.slug = 'unstitched'
  and p.slug = 'hira-unstitched'
  and p.category_id is distinct from c.id;

-- Keep the storefront/index statistics consistent after the updates.
analyze public.products;
-- ---------------------------------------------------------------------------
-- 00016: Restore canonical seed sort_order
--
-- Bug: update_product's schema defaulted sortOrder to 0 when the AI did not
-- supply it (get_product never returns sort_order, so the model could never
-- round-trip it). Every product edited through the AI got sort_order reset to
-- 0, pushing products like Khirke Jamawar to the front of every catalog
-- listing (ORDER BY sort_order ASC) and making them resurface in unrelated
-- turns. The tool now performs a partial update (see tools/catalog-admin.ts),
-- so this cannot recur. This migration restores the seed ordering for the six
-- products corrupted during QA edits.
--
-- Idempotent: keyed by canonical slug; setting the same value twice is safe.
-- ---------------------------------------------------------------------------

update public.products p
set sort_order = v.sort
from (
  values
    ('khirke-jamawar', 1),
    ('sukoon-cotton', 14),
    ('rihla-cotton', 16),
    ('naseem-plain-kurta', 17),
    ('hira-unstitched', 19),
    ('raat-ki-rani-lawn', 23)
) as v(slug, sort)
where p.slug = v.slug
  and p.sort_order <> v.sort;

-- Keep the storefront index consistent with the restored ordering.
analyze public.products;
-- Order number prefix: DIN -> DINS
--
-- The brand is "DINS by Daniyal", but the order number generator produced
-- 'DIN-YYYYMMDD-NNNN'. This migration replaces public.generate_order_number()
-- so newly created orders use the 'DINS-' prefix.
--
-- Scope is intentionally minimal:
--   * Only the GENERATOR changes. Existing orders keep their current
--     order_number values untouched (no data migration, no rewriting history).
--   * The uniqueness loop and the orders_order_number_idx unique index are
--     unchanged, so collision handling behaves exactly as before.
--   * The function keeps the same signature, security definer, and search_path,
--     so grants from migration 00012 still apply (create or replace preserves
--     existing privileges).

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
    v_number := 'DINS-' || to_char(now(), 'YYYYMMDD') || '-' ||
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
  'Generates a unique human-readable order number like DINS-20260910-0001.';

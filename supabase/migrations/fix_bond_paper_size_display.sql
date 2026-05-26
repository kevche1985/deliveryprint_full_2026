BEGIN;

UPDATE public.product_variant_groups
SET display = 'dropdown'
WHERE name = 'Bond Paper Size';

COMMIT;


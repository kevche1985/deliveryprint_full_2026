ALTER TABLE IF EXISTS public.products
ADD COLUMN IF NOT EXISTS is_quotable boolean NOT NULL DEFAULT false;

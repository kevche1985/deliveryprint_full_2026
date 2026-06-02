ALTER TABLE IF EXISTS product_variant_options
ADD COLUMN IF NOT EXISTS tier_pricing JSONB;


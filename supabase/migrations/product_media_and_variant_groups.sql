BEGIN;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS short_description text,
  ADD COLUMN IF NOT EXISTS technique text,
  ADD COLUMN IF NOT EXISTS has_archive_guide boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS accepts_uploads boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_customizable boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS rating numeric(2, 1),
  ADD COLUMN IF NOT EXISTS review_count integer,
  ADD COLUMN IF NOT EXISTS wholesale_tiers jsonb,
  ADD COLUMN IF NOT EXISTS specifications jsonb,
  ADD COLUMN IF NOT EXISTS shipping_info text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('product-media', 'product-media', false)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated manage product-media'
  ) THEN
    CREATE POLICY "Authenticated manage product-media" ON storage.objects
      FOR ALL USING (bucket_id = 'product-media') WITH CHECK (bucket_id = 'product-media');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.product_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  type text NOT NULL CHECK (type IN ('image', 'video')),
  alt_text text,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_media_product ON public.product_media(product_id);
CREATE INDEX IF NOT EXISTS idx_product_media_tenant ON public.product_media(tenant_id);

ALTER TABLE public.product_media ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.product_variant_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL,
  display text NOT NULL CHECK (display IN ('dropdown', 'chips')),
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_variant_groups_product ON public.product_variant_groups(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variant_groups_tenant ON public.product_variant_groups(tenant_id);

ALTER TABLE public.product_variant_groups ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.product_variant_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id),
  group_id uuid NOT NULL REFERENCES public.product_variant_groups(id) ON DELETE CASCADE,
  label text NOT NULL,
  price_modifier numeric(10, 2) NOT NULL DEFAULT 0,
  is_available boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_variant_options_group ON public.product_variant_options(group_id);
CREATE INDEX IF NOT EXISTS idx_product_variant_options_tenant ON public.product_variant_options(tenant_id);

ALTER TABLE public.product_variant_options ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'product_media' AND policyname = 'Everyone can view product media'
  ) THEN
    CREATE POLICY "Everyone can view product media" ON public.product_media
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.products
          WHERE public.products.id = public.product_media.product_id
          AND public.products.is_active = true
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'product_media' AND policyname = 'Admins can manage product media'
  ) THEN
    CREATE POLICY "Admins can manage product media" ON public.product_media
      FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'product_variant_groups' AND policyname = 'Everyone can view product variant groups'
  ) THEN
    CREATE POLICY "Everyone can view product variant groups" ON public.product_variant_groups
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.products
          WHERE public.products.id = public.product_variant_groups.product_id
          AND public.products.is_active = true
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'product_variant_groups' AND policyname = 'Admins can manage product variant groups'
  ) THEN
    CREATE POLICY "Admins can manage product variant groups" ON public.product_variant_groups
      FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'product_variant_options' AND policyname = 'Everyone can view product variant options'
  ) THEN
    CREATE POLICY "Everyone can view product variant options" ON public.product_variant_options
      FOR SELECT USING (
        EXISTS (
          SELECT 1
          FROM public.product_variant_groups g
          JOIN public.products p ON p.id = g.product_id
          WHERE g.id = public.product_variant_options.group_id
          AND p.is_active = true
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'product_variant_options' AND policyname = 'Admins can manage product variant options'
  ) THEN
    CREATE POLICY "Admins can manage product variant options" ON public.product_variant_options
      FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
  END IF;
END$$;

COMMIT;

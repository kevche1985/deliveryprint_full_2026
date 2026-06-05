CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS service_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  base_price numeric(10,2) NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  config jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_products_service_sort
  ON service_products (service_id, sort_order);

ALTER TABLE service_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_products_admin_manage ON service_products;
CREATE POLICY service_products_admin_manage ON service_products
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.role IN ('admin','operator')
        AND up.active_tenant_id = service_products.tenant_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.role IN ('admin','operator')
        AND up.active_tenant_id = service_products.tenant_id
    )
  );

DROP POLICY IF EXISTS service_products_public_read ON service_products;
CREATE POLICY service_products_public_read ON service_products
  FOR SELECT
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.services s
      WHERE s.id = service_products.service_id
        AND s.is_active = true
    )
  );

CREATE TABLE IF NOT EXISTS service_product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES service_products(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  url text NOT NULL,
  alt_text text,
  sort_order integer NOT NULL DEFAULT 0,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS service_product_images_one_primary
  ON service_product_images (product_id)
  WHERE is_primary = true;

CREATE INDEX IF NOT EXISTS idx_service_product_images_product_sort
  ON service_product_images (product_id, sort_order);

ALTER TABLE service_product_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_product_images_admin_manage ON service_product_images;
CREATE POLICY service_product_images_admin_manage ON service_product_images
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.role IN ('admin','operator')
        AND up.active_tenant_id = service_product_images.tenant_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.role IN ('admin','operator')
        AND up.active_tenant_id = service_product_images.tenant_id
    )
  );

DROP POLICY IF EXISTS service_product_images_public_read ON service_product_images;
CREATE POLICY service_product_images_public_read ON service_product_images
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.service_products sp
      JOIN public.services s ON s.id = sp.service_id
      WHERE sp.id = service_product_images.product_id
        AND sp.is_active = true
        AND s.is_active = true
    )
  );

CREATE TABLE IF NOT EXISTS service_product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES service_products(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_product_variants_product_sort
  ON service_product_variants (product_id, sort_order);

ALTER TABLE service_product_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_product_variants_admin_manage ON service_product_variants;
CREATE POLICY service_product_variants_admin_manage ON service_product_variants
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.role IN ('admin','operator')
        AND up.active_tenant_id = service_product_variants.tenant_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.role IN ('admin','operator')
        AND up.active_tenant_id = service_product_variants.tenant_id
    )
  );

DROP POLICY IF EXISTS service_product_variants_public_read ON service_product_variants;
CREATE POLICY service_product_variants_public_read ON service_product_variants
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.service_products sp
      JOIN public.services s ON s.id = sp.service_id
      WHERE sp.id = service_product_variants.product_id
        AND sp.is_active = true
        AND s.is_active = true
    )
  );

CREATE TABLE IF NOT EXISTS service_product_variant_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES service_product_variants(id) ON DELETE CASCADE,
  label text NOT NULL,
  price_delta numeric(10,2) NOT NULL DEFAULT 0,
  sku_suffix text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_service_product_variant_options_variant_sort
  ON service_product_variant_options (variant_id, sort_order);

ALTER TABLE service_product_variant_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_product_variant_options_admin_manage ON service_product_variant_options;
CREATE POLICY service_product_variant_options_admin_manage ON service_product_variant_options
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles up
      JOIN public.service_product_variants sv ON sv.id = service_product_variant_options.variant_id
      WHERE up.id = auth.uid()
        AND up.role IN ('admin','operator')
        AND up.active_tenant_id = service_product_variant_options.tenant_id
        AND sv.tenant_id = up.active_tenant_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_profiles up
      JOIN public.service_product_variants sv ON sv.id = service_product_variant_options.variant_id
      WHERE up.id = auth.uid()
        AND up.role IN ('admin','operator')
        AND up.active_tenant_id = service_product_variant_options.tenant_id
        AND sv.tenant_id = up.active_tenant_id
    )
  );

DROP POLICY IF EXISTS service_product_variant_options_public_read ON service_product_variant_options;
CREATE POLICY service_product_variant_options_public_read ON service_product_variant_options
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.service_product_variants sv
      JOIN public.service_products sp ON sp.id = sv.product_id
      JOIN public.services s ON s.id = sp.service_id
      WHERE sv.id = service_product_variant_options.variant_id
        AND sp.is_active = true
        AND s.is_active = true
    )
  );

CREATE OR REPLACE FUNCTION admin_replace_service_product_variants(p_tenant_id uuid, p_product_id uuid, p_variants jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v jsonb;
  o jsonb;
  v_id uuid;
  o_id uuid;
BEGIN
  DELETE FROM public.service_product_variants
  WHERE tenant_id = p_tenant_id
    AND product_id = p_product_id;

  FOR v IN SELECT * FROM jsonb_array_elements(COALESCE(p_variants, '[]'::jsonb))
  LOOP
    v_id :=
      CASE
        WHEN (v->>'id') IS NOT NULL
          AND length(v->>'id') = 36
          AND (v->>'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN (v->>'id')::uuid
        ELSE gen_random_uuid()
      END;

    INSERT INTO public.service_product_variants (id, tenant_id, product_id, name, sort_order)
    VALUES (
      v_id,
      p_tenant_id,
      p_product_id,
      COALESCE(NULLIF(v->>'name',''), ''),
      COALESCE(NULLIF(v->>'sortOrder',''), '0')::int
    );

    FOR o IN SELECT * FROM jsonb_array_elements(COALESCE(v->'options', '[]'::jsonb))
    LOOP
      o_id :=
        CASE
          WHEN (o->>'id') IS NOT NULL
            AND length(o->>'id') = 36
            AND (o->>'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          THEN (o->>'id')::uuid
          ELSE gen_random_uuid()
        END;

      INSERT INTO public.service_product_variant_options (id, tenant_id, variant_id, label, price_delta, sku_suffix, sort_order, is_active)
      VALUES (
        o_id,
        p_tenant_id,
        v_id,
        COALESCE(NULLIF(o->>'label',''), ''),
        COALESCE(NULLIF(o->>'priceDelta',''), '0')::numeric,
        NULLIF(o->>'skuSuffix',''),
        COALESCE(NULLIF(o->>'sortOrder',''), '0')::int,
        COALESCE((o->>'isActive')::boolean, true)
      );
    END LOOP;
  END LOOP;

  RETURN (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', sv.id,
        'productId', sv.product_id,
        'name', sv.name,
        'sortOrder', sv.sort_order,
        'options', COALESCE(opts.options, '[]'::jsonb)
      ) ORDER BY sv.sort_order
    )
    FROM public.service_product_variants sv
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', svo.id,
          'variantId', svo.variant_id,
          'label', svo.label,
          'priceDelta', svo.price_delta,
          'skuSuffix', svo.sku_suffix,
          'sortOrder', svo.sort_order,
          'isActive', svo.is_active
        ) ORDER BY svo.sort_order
      ) AS options
      FROM public.service_product_variant_options svo
      WHERE svo.variant_id = sv.id
    ) opts ON true
    WHERE sv.tenant_id = p_tenant_id
      AND sv.product_id = p_product_id
  );
END;
$$;

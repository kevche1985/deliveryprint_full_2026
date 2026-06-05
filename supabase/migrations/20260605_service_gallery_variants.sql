CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS service_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  url text NOT NULL,
  alt_text text,
  sort_order integer NOT NULL DEFAULT 0,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS service_images_one_primary
  ON service_images (service_id)
  WHERE is_primary = true;

CREATE INDEX IF NOT EXISTS idx_service_images_service_sort
  ON service_images (service_id, sort_order);

ALTER TABLE service_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_images_admin_manage ON service_images;
CREATE POLICY service_images_admin_manage ON service_images
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.role IN ('admin','operator')
        AND up.active_tenant_id = service_images.tenant_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.role IN ('admin','operator')
        AND up.active_tenant_id = service_images.tenant_id
    )
  );

DROP POLICY IF EXISTS service_images_public_read ON service_images;
CREATE POLICY service_images_public_read ON service_images
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.services s
      WHERE s.id = service_images.service_id
        AND s.is_active = true
    )
  );

CREATE TABLE IF NOT EXISTS service_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_variants_service_sort
  ON service_variants (service_id, sort_order);

ALTER TABLE service_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_variants_admin_manage ON service_variants;
CREATE POLICY service_variants_admin_manage ON service_variants
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.role IN ('admin','operator')
        AND up.active_tenant_id = service_variants.tenant_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.role IN ('admin','operator')
        AND up.active_tenant_id = service_variants.tenant_id
    )
  );

DROP POLICY IF EXISTS service_variants_public_read ON service_variants;
CREATE POLICY service_variants_public_read ON service_variants
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.services s
      WHERE s.id = service_variants.service_id
        AND s.is_active = true
    )
  );

CREATE TABLE IF NOT EXISTS service_variant_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES service_variants(id) ON DELETE CASCADE,
  label text NOT NULL,
  price_delta numeric(10,2) NOT NULL DEFAULT 0,
  sku_suffix text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_service_variant_options_variant_sort
  ON service_variant_options (variant_id, sort_order);

ALTER TABLE service_variant_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_variant_options_admin_manage ON service_variant_options;
CREATE POLICY service_variant_options_admin_manage ON service_variant_options
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles up
      JOIN public.service_variants sv ON sv.id = service_variant_options.variant_id
      WHERE up.id = auth.uid()
        AND up.role IN ('admin','operator')
        AND up.active_tenant_id = service_variant_options.tenant_id
        AND sv.tenant_id = up.active_tenant_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_profiles up
      JOIN public.service_variants sv ON sv.id = service_variant_options.variant_id
      WHERE up.id = auth.uid()
        AND up.role IN ('admin','operator')
        AND up.active_tenant_id = service_variant_options.tenant_id
        AND sv.tenant_id = up.active_tenant_id
    )
  );

DROP POLICY IF EXISTS service_variant_options_public_read ON service_variant_options;
CREATE POLICY service_variant_options_public_read ON service_variant_options
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.service_variants sv
      JOIN public.services s ON s.id = sv.service_id
      WHERE sv.id = service_variant_options.variant_id
        AND s.is_active = true
    )
  );

INSERT INTO service_images (tenant_id, service_id, storage_path, url, alt_text, sort_order, is_primary)
SELECT
  (SELECT id FROM public.tenants WHERE slug = 'primary' LIMIT 1) AS tenant_id,
  s.id AS service_id,
  CASE
    WHEN s.image LIKE '%/storage/v1/object/public/product-images/%'
      THEN regexp_replace(s.image, '^.*?/storage/v1/object/public/product-images/', '')
    ELSE s.image
  END AS storage_path,
  s.image AS url,
  s.name AS alt_text,
  0 AS sort_order,
  true AS is_primary
FROM public.services s
WHERE s.image IS NOT NULL
  AND s.image <> ''
  AND NOT EXISTS (SELECT 1 FROM public.service_images si WHERE si.service_id = s.id);

CREATE OR REPLACE FUNCTION admin_replace_service_variants(p_tenant_id uuid, p_service_id uuid, p_variants jsonb)
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
  DELETE FROM public.service_variants
  WHERE tenant_id = p_tenant_id
    AND service_id = p_service_id;

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

    INSERT INTO public.service_variants (id, tenant_id, service_id, name, sort_order)
    VALUES (
      v_id,
      p_tenant_id,
      p_service_id,
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

      INSERT INTO public.service_variant_options (id, tenant_id, variant_id, label, price_delta, sku_suffix, sort_order, is_active)
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
        'serviceId', sv.service_id,
        'name', sv.name,
        'sortOrder', sv.sort_order,
        'options', COALESCE(opts.options, '[]'::jsonb)
      ) ORDER BY sv.sort_order
    )
    FROM public.service_variants sv
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
      FROM public.service_variant_options svo
      WHERE svo.variant_id = sv.id
    ) opts ON true
    WHERE sv.tenant_id = p_tenant_id
      AND sv.service_id = p_service_id
  );
END;
$$;

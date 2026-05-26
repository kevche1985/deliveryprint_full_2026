BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.tenant_branding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  state text NOT NULL CHECK (state IN ('draft','published','archived')),
  version_number integer NOT NULL DEFAULT 1,
  published_at timestamptz,
  published_by uuid,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_branding_tenant_state ON public.tenant_branding(tenant_id, state);
CREATE INDEX IF NOT EXISTS idx_tenant_branding_tenant_version ON public.tenant_branding(tenant_id, version_number DESC);

ALTER TABLE public.tenant_branding ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tenant_branding' AND policyname = 'public_read_published_branding'
  ) THEN
    CREATE POLICY public_read_published_branding ON public.tenant_branding
      FOR SELECT
      USING (state = 'published');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tenant_branding' AND policyname = 'admin_operator_read_active_tenant_branding'
  ) THEN
    CREATE POLICY admin_operator_read_active_tenant_branding ON public.tenant_branding
      FOR SELECT
      USING (
        tenant_id = (SELECT active_tenant_id FROM public.user_profiles up WHERE up.id = auth.uid())
        AND EXISTS (
          SELECT 1 FROM public.user_profiles up2
          WHERE up2.id = auth.uid() AND up2.role IN ('admin','operator')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tenant_branding' AND policyname = 'admin_operator_manage_active_tenant_branding'
  ) THEN
    CREATE POLICY admin_operator_manage_active_tenant_branding ON public.tenant_branding
      FOR ALL
      USING (
        tenant_id = (SELECT active_tenant_id FROM public.user_profiles up WHERE up.id = auth.uid())
        AND EXISTS (
          SELECT 1 FROM public.user_profiles up2
          WHERE up2.id = auth.uid() AND up2.role IN ('admin','operator')
        )
      )
      WITH CHECK (
        tenant_id = (SELECT active_tenant_id FROM public.user_profiles up WHERE up.id = auth.uid())
        AND EXISTS (
          SELECT 1 FROM public.user_profiles up2
          WHERE up2.id = auth.uid() AND up2.role IN ('admin','operator')
        )
      );
  END IF;
END$$;

DROP TRIGGER IF EXISTS trg_tenant_branding_updated_at ON public.tenant_branding;
CREATE TRIGGER trg_tenant_branding_updated_at BEFORE UPDATE ON public.tenant_branding FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

GRANT SELECT ON public.tenant_branding TO anon;
GRANT ALL PRIVILEGES ON public.tenant_branding TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'branding',
  'branding',
  true,
  5242880,
  ARRAY[
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'image/svg+xml'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY[
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'image/svg+xml'
  ];

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'public_view_branding'
  ) THEN
    CREATE POLICY public_view_branding ON storage.objects
      FOR SELECT
      USING (bucket_id = 'branding');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'service_manage_branding'
  ) THEN
    CREATE POLICY service_manage_branding ON storage.objects
      FOR ALL
      USING (bucket_id = 'branding');
  END IF;
END$$;

COMMIT;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS system_customization (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_name TEXT DEFAULT 'DeliveryPrint',
  logo_url TEXT,
  colors JSONB DEFAULT '{"primary":"#8B0000","accent":"#6B0000","background":"#ffffff","text":"#111827","link":"#8B0000"}'::jsonb,
  fonts JSONB DEFAULT '{"heading":"Inter","body":"Inter"}'::jsonb,
  contact JSONB DEFAULT '{}'::jsonb,
  modules JSONB DEFAULT '{"services":true,"products":true,"quotes":true,"support":true,"aiStudio":true,"orders":true}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE system_customization ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'system_customization' AND policyname = 'system_customization_admin_manage'
  ) THEN
    CREATE POLICY system_customization_admin_manage ON system_customization
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.role IN ('admin','operator')
        )
      ) WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.role IN ('admin','operator')
        )
      );
  END IF;
END$$;

CREATE OR REPLACE FUNCTION set_system_customization_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_system_customization_updated_at ON system_customization;
CREATE TRIGGER trg_system_customization_updated_at
BEFORE UPDATE ON system_customization
FOR EACH ROW EXECUTE FUNCTION set_system_customization_updated_at();

-- Seed a default row if table empty
INSERT INTO system_customization (brand_name)
SELECT 'DeliveryPrint' WHERE NOT EXISTS (SELECT 1 FROM system_customization);


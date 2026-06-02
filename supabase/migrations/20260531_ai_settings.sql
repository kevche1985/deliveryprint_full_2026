CREATE TABLE IF NOT EXISTS ai_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID,
  provider TEXT NOT NULL DEFAULT 'openai',
  model TEXT NOT NULL DEFAULT 'dall-e-3',
  base_url TEXT,
  api_key TEXT,
  max_output_tokens INTEGER NOT NULL DEFAULT 2048,
  temperature NUMERIC NOT NULL DEFAULT 0.2,
  timeout_ms INTEGER NOT NULL DEFAULT 30000,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ai_settings_tenant_unique ON ai_settings(tenant_id);

ALTER TABLE ai_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ai_settings' AND policyname = 'ai_settings_admin_manage'
  ) THEN
    CREATE POLICY ai_settings_admin_manage ON ai_settings
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles up
          WHERE up.id = auth.uid() AND up.role IN ('admin','operator')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.user_profiles up
          WHERE up.id = auth.uid() AND up.role IN ('admin','operator')
        )
      );
  END IF;
END$$;


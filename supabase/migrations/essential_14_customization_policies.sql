DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='system_customization' AND policyname='system_customization_admin_manage_kv'
  ) THEN
    CREATE POLICY system_customization_admin_manage_kv ON system_customization
      FOR ALL USING (
        EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.role IN ('admin','operator'))
      ) WITH CHECK (
        EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.role IN ('admin','operator'))
      );
  END IF;
END$$;


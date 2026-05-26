DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'payment_settings'
  ) THEN
    UPDATE payment_settings
    SET additional_settings =
      COALESCE(additional_settings, '{}'::jsonb) ||
      CASE
        WHEN (COALESCE(additional_settings, '{}'::jsonb) ? 'bypass_wompi') THEN '{}'::jsonb
        ELSE jsonb_build_object('bypass_wompi', false)
      END
    WHERE provider_name = 'wompi';
  END IF;
END $$;

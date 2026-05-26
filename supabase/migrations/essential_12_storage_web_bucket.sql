-- Create web bucket for site assets (logos, banners, etc.)
INSERT INTO storage.buckets (id, name, public)
VALUES ('web', 'web', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Public read policy for 'web' bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public read web bucket'
  ) THEN
    CREATE POLICY "Public read web bucket" ON storage.objects
      FOR SELECT USING (bucket_id = 'web');
  END IF;
END$$;

-- Admin/operator manage policy for 'web' bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Admin manage web bucket'
  ) THEN
    CREATE POLICY "Admin manage web bucket" ON storage.objects
      FOR ALL USING (
        bucket_id = 'web' AND EXISTS (
          SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.role IN ('admin','operator')
        )
      ) WITH CHECK (
        bucket_id = 'web' AND EXISTS (
          SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.role IN ('admin','operator')
        )
      );
  END IF;
END$$;

BEGIN;

UPDATE storage.buckets
SET public = true
WHERE id = 'product-media';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public read product-media'
  ) THEN
    CREATE POLICY "Public read product-media" ON storage.objects
      FOR SELECT USING (bucket_id = 'product-media');
  END IF;
END$$;

COMMIT;


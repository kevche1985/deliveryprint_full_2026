-- Create product-images bucket used by admin product image uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to product-images bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public read product-images'
  ) THEN
    CREATE POLICY "Public read product-images" ON storage.objects
      FOR SELECT USING (bucket_id = 'product-images');
  END IF;
END$$;

-- Allow authenticated users to manage objects in product-images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated manage product-images'
  ) THEN
    CREATE POLICY "Authenticated manage product-images" ON storage.objects
      FOR ALL USING (bucket_id = 'product-images') WITH CHECK (bucket_id = 'product-images');
  END IF;
END$$;


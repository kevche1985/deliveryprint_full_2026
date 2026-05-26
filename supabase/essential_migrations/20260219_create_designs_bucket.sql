INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'designs',
  'designs',
  true,
  52428800,
  ARRAY[
    'application/pdf',
    'application/zip',
    'application/x-zip-compressed',
    'application/octet-stream',
    'image/png',
    'image/jpeg',
    'image/jpg'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY[
    'application/pdf',
    'application/zip',
    'application/x-zip-compressed',
    'application/octet-stream',
    'image/png',
    'image/jpeg',
    'image/jpg'
  ];

CREATE POLICY IF NOT EXISTS "Public can view designs" ON storage.objects
FOR SELECT USING (bucket_id = 'designs');

CREATE POLICY IF NOT EXISTS "Service role can manage designs" ON storage.objects
FOR ALL USING (bucket_id = 'designs');


-- Seed default keys in key-value system_customization table
INSERT INTO system_customization (key, value)
VALUES
('brand_name', '"DeliveryPrint"'::jsonb),
('logo_url', '"https://mrwjrnmxgdvuuudjurly.supabase.co/storage/v1/object/public/web/web-logo.png"'::jsonb),
('colors', '{"primary":"#8B0000","accent":"#6B0000","background":"#ffffff","text":"#111827","link":"#8B0000"}'::jsonb),
('fonts', '{"heading":"Inter","body":"Inter"}'::jsonb),
('contact', '{}'::jsonb),
('modules', '{"services":true,"products":true,"quotes":true,"support":true,"aiStudio":true,"orders":true}'::jsonb)
ON CONFLICT (key) DO NOTHING;


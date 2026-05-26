DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'digital-printing') THEN
    INSERT INTO categories (name, slug, description, is_active) VALUES
    ('Digital Printing','digital-printing','Digital printing services',true),
    ('Large Format','large-format','Banners and posters',true),
    ('Event Stands','event-stands','Portable event stands',true),
    ('Illuminated Signs','illuminated-signs','Backlit and LED signage',true);
  END IF;
END$$;

DO $$
DECLARE c1 UUID; c2 UUID; c3 UUID; c4 UUID; pid UUID;
BEGIN
  SELECT id INTO c1 FROM categories WHERE slug='digital-printing' LIMIT 1;
  SELECT id INTO c2 FROM categories WHERE slug='large-format' LIMIT 1;
  SELECT id INTO c3 FROM categories WHERE slug='event-stands' LIMIT 1;
  SELECT id INTO c4 FROM categories WHERE slug='illuminated-signs' LIMIT 1;

  IF NOT EXISTS (SELECT 1 FROM products WHERE name='Business Cards') THEN
    INSERT INTO products (name, description, price, category, image, is_active, is_featured, is_customizable)
    VALUES ('Business Cards','Premium matte finish',19.99,'digital-printing',NULL,true,true,true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM products WHERE name='Large Banner') THEN
    INSERT INTO products (name, description, price, category, image, is_active, is_featured, is_customizable)
    VALUES ('Large Banner','Durable outdoor banner',49.99,'large-format',NULL,true,false,true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM products WHERE name='Event Stand') THEN
    INSERT INTO products (name, description, price, category, image, is_active, is_featured, is_customizable)
    VALUES ('Event Stand','Portable X-stand with print',69.99,'event-stands',NULL,true,false,true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM products WHERE name='LED Sign') THEN
    INSERT INTO products (name, description, price, category, image, is_active, is_featured, is_customizable)
    VALUES ('LED Sign','Backlit sign',129.00,'illuminated-signs',NULL,true,false,true);
  END IF;
END$$;

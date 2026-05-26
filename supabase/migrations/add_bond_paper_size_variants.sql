DO $$
DECLARE
  p RECORD;
  g_id uuid;
BEGIN
  FOR p IN
    SELECT id, tenant_id
    FROM public.products
    WHERE
      lower(name) IN ('digital impression', 'impresión digital', 'impresion digital', 'digital printing')
      OR name ILIKE '%digital%impress%'
      OR name ILIKE '%impresi%n%digital%'
  LOOP
    SELECT id
    INTO g_id
    FROM public.product_variant_groups
    WHERE product_id = p.id
      AND name = 'Bond Paper Size'
    LIMIT 1;

    IF g_id IS NULL THEN
      INSERT INTO public.product_variant_groups (tenant_id, product_id, name, display, sort_order)
      VALUES (p.tenant_id, p.id, 'Bond Paper Size', 'chips', 50)
      RETURNING id INTO g_id;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.product_variant_options
      WHERE group_id = g_id
        AND label = 'Tamaño Carta'
    ) THEN
      INSERT INTO public.product_variant_options (tenant_id, group_id, label, price_modifier, is_available, sort_order)
      VALUES (p.tenant_id, g_id, 'Tamaño Carta', 0, true, 0);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.product_variant_options
      WHERE group_id = g_id
        AND label = 'A4'
    ) THEN
      INSERT INTO public.product_variant_options (tenant_id, group_id, label, price_modifier, is_available, sort_order)
      VALUES (p.tenant_id, g_id, 'A4', 0, true, 1);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.product_variant_options
      WHERE group_id = g_id
        AND label = '12x18”'
    ) THEN
      INSERT INTO public.product_variant_options (tenant_id, group_id, label, price_modifier, is_available, sort_order)
      VALUES (p.tenant_id, g_id, '12x18”', 0, true, 2);
    END IF;
  END LOOP;
END $$;


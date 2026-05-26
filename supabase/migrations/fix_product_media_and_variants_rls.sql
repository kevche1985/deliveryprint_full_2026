BEGIN;

DROP POLICY IF EXISTS "Admins can manage product media" ON public.product_media;
DROP POLICY IF EXISTS "Admins can manage product variant groups" ON public.product_variant_groups;
DROP POLICY IF EXISTS "Admins can manage product variant options" ON public.product_variant_options;

CREATE POLICY "Admins can manage product media" ON public.product_media
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.role IN ('admin', 'operator')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.role IN ('admin', 'operator')
  ));

CREATE POLICY "Admins can manage product variant groups" ON public.product_variant_groups
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.role IN ('admin', 'operator')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.role IN ('admin', 'operator')
  ));

CREATE POLICY "Admins can manage product variant options" ON public.product_variant_options
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.role IN ('admin', 'operator')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.role IN ('admin', 'operator')
  ));

COMMIT;


-- Enable RLS and add policies for public.coupon_applications
-- Safe-guarded to avoid duplicates on repeated migrations

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema='public' AND table_name='coupon_applications'
  ) THEN
    RAISE NOTICE 'Table public.coupon_applications does not exist, skipping.';
  ELSE
    -- Enable RLS
    EXECUTE 'ALTER TABLE public.coupon_applications ENABLE ROW LEVEL SECURITY';

    -- Admin/operator full access (useful if using user-scoped clients)
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname='public' AND tablename='coupon_applications' AND policyname='admin_manage_coupon_applications'
    ) THEN
      CREATE POLICY admin_manage_coupon_applications
      ON public.coupon_applications
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 
          FROM public.user_profiles up 
          WHERE up.id = auth.uid() AND up.role IN ('admin','operator')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 
          FROM public.user_profiles up 
          WHERE up.id = auth.uid() AND up.role IN ('admin','operator')
        )
      );
    END IF;

    -- Authenticated users can SELECT their own coupon applications by user_id
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname='public' AND tablename='coupon_applications' AND policyname='user_select_own_coupon_applications'
    ) THEN
      CREATE POLICY user_select_own_coupon_applications
      ON public.coupon_applications
      FOR SELECT
      USING (
        auth.role() = 'authenticated' 
        AND user_id = auth.uid()
      );
    END IF;

    -- Authenticated users can INSERT only rows for themselves
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname='public' AND tablename='coupon_applications' AND policyname='user_insert_own_coupon_applications'
    ) THEN
      CREATE POLICY user_insert_own_coupon_applications
      ON public.coupon_applications
      FOR INSERT
      WITH CHECK (
        auth.role() = 'authenticated'
        AND user_id = auth.uid()
      );
    END IF;

    -- Optional: SELECT if tied to user's order (covers legacy rows with user_id null)
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname='public' AND tablename='coupon_applications' AND policyname='user_select_by_order_ownership'
    ) THEN
      CREATE POLICY user_select_by_order_ownership
      ON public.coupon_applications
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.orders o 
          WHERE o.id = coupon_applications.order_id 
            AND o.user_id = auth.uid()
        )
      );
    END IF;
  END IF;
END$$;


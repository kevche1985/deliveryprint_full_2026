CREATE TABLE IF NOT EXISTS public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  code_type text NOT NULL DEFAULT 'standard',
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'enabled',
  discount_type text NOT NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  bx_qty integer,
  gy_qty integer,
  gy_product_id uuid,
  free_shipping boolean NOT NULL DEFAULT false,
  start_at timestamptz NOT NULL DEFAULT now(),
  end_at timestamptz,
  min_amount numeric(12,2) NOT NULL DEFAULT 0,
  min_qty integer NOT NULL DEFAULT 0,
  max_discount_cap numeric(12,2),
  usage_limit_total integer,
  usage_limit_per_customer integer,
  eligible_product_ids uuid[],
  eligible_category_ids uuid[],
  eligible_group_ids uuid[],
  eligible_emails text[],
  new_customers_only boolean NOT NULL DEFAULT false,
  total_redemptions integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS coupons_code_unique_lower ON public.coupons (lower(code));

CREATE TABLE IF NOT EXISTS public.coupon_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  code text NOT NULL,
  assigned_email text,
  referrer_user_id uuid,
  status text NOT NULL DEFAULT 'pending',
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS coupon_codes_code_unique_lower ON public.coupon_codes (lower(code));
CREATE INDEX IF NOT EXISTS coupon_codes_coupon_status_idx ON public.coupon_codes (coupon_id, status);

CREATE TABLE IF NOT EXISTS public.coupon_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE SET NULL,
  code text NOT NULL,
  order_id uuid,
  user_id uuid,
  discount_value numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.coupon_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  headline text NOT NULL,
  supporting_text text,
  cta_label text,
  cta_url text,
  bg_type text NOT NULL DEFAULT 'color',
  bg_value text,
  text_color text,
  position text NOT NULL DEFAULT 'sticky',
  show_close boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'disabled',
  start_at timestamptz,
  end_at timestamptz,
  priority integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_banners ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='coupons' AND policyname='admin_manage_coupons'
  ) THEN
    CREATE POLICY admin_manage_coupons ON public.coupons FOR ALL USING (
      EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.role IN ('admin','operator'))
    ) WITH CHECK (
      EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.role IN ('admin','operator'))
    );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='coupon_codes' AND policyname='admin_manage_coupon_codes'
  ) THEN
    CREATE POLICY admin_manage_coupon_codes ON public.coupon_codes FOR ALL USING (
      EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.role IN ('admin','operator'))
    ) WITH CHECK (
      EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.role IN ('admin','operator'))
    );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='coupon_banners' AND policyname='admin_manage_coupon_banners'
  ) THEN
    CREATE POLICY admin_manage_coupon_banners ON public.coupon_banners FOR ALL USING (
      EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.role IN ('admin','operator'))
    ) WITH CHECK (
      EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.role IN ('admin','operator'))
    );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='coupon_banners' AND policyname='public_read_active_banners'
  ) THEN
    CREATE POLICY public_read_active_banners ON public.coupon_banners FOR SELECT USING (
      status = 'enabled' AND (start_at IS NULL OR start_at <= now()) AND (end_at IS NULL OR end_at >= now())
    );
  END IF;
END$$;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_coupons_updated_at ON public.coupons;
CREATE TRIGGER trg_coupons_updated_at BEFORE UPDATE ON public.coupons FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_coupon_codes_updated_at ON public.coupon_codes;
CREATE TRIGGER trg_coupon_codes_updated_at BEFORE UPDATE ON public.coupon_codes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_coupon_banners_updated_at ON public.coupon_banners;
CREATE TRIGGER trg_coupon_banners_updated_at BEFORE UPDATE ON public.coupon_banners FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


-- Customization settings per tenant
CREATE TABLE IF NOT EXISTS public.tenant_customization (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  -- Brand Identity
  company_name TEXT,
  logo_url TEXT,
  -- Appearance
  primary_color TEXT DEFAULT '#8B0000',
  accent_color TEXT DEFAULT '#6B0000',
  background_color TEXT DEFAULT '#ffffff',
  text_color TEXT DEFAULT '#000000',
  heading_font TEXT DEFAULT 'Inter',
  body_font TEXT DEFAULT 'Inter',
  -- Contact Info
  contact_email TEXT,
  contact_phone TEXT,
  street_address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  country TEXT,
  website_url TEXT,
  linkedin_url TEXT,
  instagram_url TEXT,
  facebook_url TEXT,
  twitter_url TEXT,
  -- Module visibility
  module_services BOOLEAN DEFAULT true,
  module_products BOOLEAN DEFAULT true,
  module_quotes BOOLEAN DEFAULT true,
  module_support BOOLEAN DEFAULT true,
  module_ai_studio BOOLEAN DEFAULT true,
  module_order BOOLEAN DEFAULT true,
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_id)
);

-- RLS policies
ALTER TABLE public.tenant_customization ENABLE ROW LEVEL SECURITY;

-- Admins can manage their own tenant's customization
CREATE POLICY "Admins manage own tenant customization" ON public.tenant_customization
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() 
      AND up.role IN ('admin','operator')
      AND up.id IN (SELECT id FROM public.tenants WHERE id = tenant_id)
    )
  );

-- Global system customization (fallback when no tenant)
CREATE TABLE IF NOT EXISTS public.system_customization (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS for system_customization
ALTER TABLE public.system_customization ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage system customization" ON public.system_customization
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() 
      AND up.role IN ('admin','operator')
    )
  );

-- Insert default system customization
INSERT INTO public.system_customization (key, value) VALUES
('default_theme', '{"primary":"#8B0000","accent":"#6B0000","background":"#ffffff","text":"#000000","headingFont":"Inter","bodyFont":"Inter"}'::jsonb),
('default_contact', '{"email":"","phone":"","address":"","website":""}'::jsonb),
('default_modules', '{"services":true,"products":true,"quotes":true,"support":true,"ai_studio":true,"order":true}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Grant permissions
GRANT SELECT ON public.tenant_customization TO anon, authenticated;
GRANT ALL ON public.tenant_customization TO authenticated;
GRANT SELECT ON public.system_customization TO anon, authenticated;
GRANT ALL ON public.system_customization TO authenticated;
CREATE TABLE IF NOT EXISTS email_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider VARCHAR(50) NOT NULL DEFAULT 'resend',
  api_key TEXT,
  from_email VARCHAR(255) NOT NULL,
  from_name VARCHAR(255) NOT NULL,
  admin_email VARCHAR(255),
  email_enabled BOOLEAN DEFAULT false,
  max_retry_attempts INTEGER DEFAULT 3,
  retry_delay_minutes INTEGER DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_key VARCHAR(100) UNIQUE NOT NULL,
  template_name VARCHAR(255) NOT NULL,
  subject_template TEXT NOT NULL,
  html_template TEXT NOT NULL,
  text_template TEXT,
  variables TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_key VARCHAR(100),
  recipient_email VARCHAR(255) NOT NULL,
  recipient_name VARCHAR(255),
  subject TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  message_id VARCHAR(255),
  error_message TEXT,
  metadata JSONB,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_template_key ON email_logs(template_key);
CREATE INDEX IF NOT EXISTS idx_email_templates_key ON email_templates(template_key);

ALTER TABLE email_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'email_settings' AND policyname = 'email_settings_admin_manage'
  ) THEN
    CREATE POLICY email_settings_admin_manage ON email_settings
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles up
          WHERE up.id = auth.uid() AND up.role IN ('admin','operator')
        )
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'email_templates' AND policyname = 'email_templates_admin_manage'
  ) THEN
    CREATE POLICY email_templates_admin_manage ON email_templates
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles up
          WHERE up.id = auth.uid() AND up.role IN ('admin','operator')
        )
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'email_logs' AND policyname = 'email_logs_admin_read'
  ) THEN
    CREATE POLICY email_logs_admin_read ON email_logs
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles up
          WHERE up.id = auth.uid() AND up.role IN ('admin','operator')
        )
      );
  END IF;
END$$;

INSERT INTO email_templates (template_key, template_name, subject_template, html_template, text_template, variables, is_active)
VALUES
('test_email','Test Email','Test Email - {{timestamp}}','<html><body><h1>Test</h1><p>{{test_message}}</p><p>{{timestamp}}</p></body></html>','Test\n{{test_message}}\n{{timestamp}}',ARRAY['test_message','timestamp'],true),
('order_confirmation','Order Confirmation','Order Confirmation #{{order_number}}','<html><body><h1>Order {{order_number}}</h1><p>Total ${{total_amount}}</p></body></html>','Order {{order_number}} total {{total_amount}}',ARRAY['order_number','total_amount'],true)
ON CONFLICT (template_key) DO NOTHING;

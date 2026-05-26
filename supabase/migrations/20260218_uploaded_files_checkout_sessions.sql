-- Uploaded files + checkout sessions for Wompi flow

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS uploaded_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by UUID,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  status TEXT DEFAULT 'temporary',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uploaded_files_status_check'
  ) THEN
    ALTER TABLE uploaded_files
    ADD CONSTRAINT uploaded_files_status_check
    CHECK (status IN ('temporary', 'permanent')) NOT VALID;
  END IF;
END $$;

ALTER TABLE uploaded_files VALIDATE CONSTRAINT uploaded_files_status_check;

CREATE INDEX IF NOT EXISTS idx_uploaded_files_uploaded_by ON uploaded_files(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_status ON uploaded_files(status);

CREATE TABLE IF NOT EXISTS checkout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT UNIQUE NOT NULL,
  user_id UUID,
  email TEXT,
  cart_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  shipping_address JSONB DEFAULT '{}'::jsonb,
  billing_address JSONB DEFAULT '{}'::jsonb,
  subtotal NUMERIC DEFAULT 0,
  tax NUMERIC DEFAULT 0,
  shipping NUMERIC DEFAULT 0,
  total NUMERIC DEFAULT 0,
  payment_method TEXT,
  shipping_method TEXT,
  notes TEXT,
  status TEXT DEFAULT 'pending',
  order_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'checkout_sessions_status_check'
  ) THEN
    ALTER TABLE checkout_sessions
    ADD CONSTRAINT checkout_sessions_status_check
    CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')) NOT VALID;
  END IF;
END $$;

ALTER TABLE checkout_sessions VALIDATE CONSTRAINT checkout_sessions_status_check;

CREATE INDEX IF NOT EXISTS idx_checkout_sessions_reference ON checkout_sessions(reference);
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_user_id ON checkout_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_status ON checkout_sessions(status);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_checkout_sessions_order_id'
  ) THEN
    ALTER TABLE checkout_sessions
      ADD CONSTRAINT fk_checkout_sessions_order_id
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS material_type TEXT,
  ADD COLUMN IF NOT EXISTS uploaded_file_id UUID,
  ADD COLUMN IF NOT EXISTS design_original_filename TEXT,
  ADD COLUMN IF NOT EXISTS design_file_url TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_order_items_uploaded_file_id'
  ) THEN
    ALTER TABLE order_items
      ADD CONSTRAINT fk_order_items_uploaded_file_id
      FOREIGN KEY (uploaded_file_id) REFERENCES uploaded_files(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_order_items_uploaded_file_id ON order_items(uploaded_file_id);

ALTER TABLE uploaded_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkout_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_can_view_own_uploaded_files" ON uploaded_files;
DROP POLICY IF EXISTS "admins_can_manage_uploaded_files" ON uploaded_files;

CREATE POLICY "users_can_view_own_uploaded_files" ON uploaded_files
FOR SELECT USING (uploaded_by = auth.uid());

CREATE POLICY "admins_can_manage_uploaded_files" ON uploaded_files
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
  )
);

DROP POLICY IF EXISTS "users_can_view_own_checkout_sessions" ON checkout_sessions;
DROP POLICY IF EXISTS "admins_can_manage_checkout_sessions" ON checkout_sessions;

CREATE POLICY "users_can_view_own_checkout_sessions" ON checkout_sessions
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "admins_can_manage_checkout_sessions" ON checkout_sessions
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
  )
);

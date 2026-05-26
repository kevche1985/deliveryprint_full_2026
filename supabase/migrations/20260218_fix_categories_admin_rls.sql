-- Fix categories RLS for admin UI: rely on user_profiles.role instead of JWT custom claims.

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can view active categories" ON categories;
DROP POLICY IF EXISTS "Admins can view all categories" ON categories;
DROP POLICY IF EXISTS "Admins can manage categories" ON categories;

CREATE POLICY "Everyone can view active categories" ON categories
FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can view all categories" ON categories
FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM user_profiles
    WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
  )
);

CREATE POLICY "Admins can manage categories" ON categories
FOR ALL USING (
  EXISTS (
    SELECT 1
    FROM user_profiles
    WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM user_profiles
    WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
  )
);

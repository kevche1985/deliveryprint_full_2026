CREATE OR REPLACE FUNCTION public.set_system_customization(p_key text, p_value jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.system_customization (key, value, updated_at)
  VALUES (p_key, p_value, NOW())
  ON CONFLICT (key)
  DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
END;
$$;

REVOKE ALL ON FUNCTION public.set_system_customization(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_system_customization(text, jsonb) TO anon, authenticated;


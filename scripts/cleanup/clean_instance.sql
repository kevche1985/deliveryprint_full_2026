-- Instance database cleanup (safe/transactional)
-- Parameters: cutoffDays = 7
-- Keep users: admin@example.com, operator@example.com

DO $$
DECLARE
  cutoff_interval interval := interval '7 days';
BEGIN
  RAISE NOTICE 'Starting cleanup with cutoff %', cutoff_interval;
END$$;

-- Helpers: run statement only if table exists
CREATE OR REPLACE FUNCTION exec_if_table(schema_name text, table_name text, sql text)
RETURNS void AS $$
BEGIN
  IF to_regclass(format('%I.%I', schema_name, table_name)) IS NOT NULL THEN
    EXECUTE sql;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- DRY‑RUN COUNTS (review before executing deletes)
-- Quotes & Support
SELECT 'quotes' AS table, count(*) FROM public.quotes WHERE created_at < now() - interval '7 days';
SELECT 'quote_items' AS table, count(*) FROM public.quote_items WHERE created_at < now() - interval '7 days';
SELECT 'support_tickets' AS table, count(*) FROM public.support_tickets WHERE created_at < now() - interval '7 days';
SELECT 'ticket_responses' AS table, count(*) FROM public.ticket_responses WHERE created_at < now() - interval '7 days';

-- Orders
SELECT 'orders' AS table, count(*) FROM public.orders WHERE created_at < now() - interval '7 days';
SELECT 'order_items' AS table, count(*) FROM public.order_items WHERE created_at < now() - interval '7 days';

-- Digital artifacts (if present)
SELECT 'order_files' AS table, count(*) FROM public.order_files WHERE created_at < now() - interval '7 days';
SELECT 'designs' AS table, count(*) FROM public.designs WHERE created_at < now() - interval '7 days';

-- Email logs
SELECT 'email_logs' AS table, count(*) FROM public.email_logs WHERE created_at < now() - interval '7 days';

-- APPLY DELETES (execute after reviewing counts)

-- Quotes & Support
DO $$
BEGIN
  PERFORM exec_if_table('public','ticket_responses', $$
    DELETE FROM public.ticket_responses WHERE created_at < now() - interval '7 days';
  $$);
  PERFORM exec_if_table('public','support_tickets', $$
    DELETE FROM public.support_tickets WHERE created_at < now() - interval '7 days';
  $$);
  PERFORM exec_if_table('public','quote_items', $$
    DELETE FROM public.quote_items WHERE created_at < now() - interval '7 days';
  $$);
  PERFORM exec_if_table('public','quotes', $$
    DELETE FROM public.quotes WHERE created_at < now() - interval '7 days';
  $$);
END$$;

-- Orders
DO $$
BEGIN
  PERFORM exec_if_table('public','order_items', $$
    DELETE FROM public.order_items WHERE created_at < now() - interval '7 days';
  $$);
  PERFORM exec_if_table('public','orders', $$
    DELETE FROM public.orders WHERE created_at < now() - interval '7 days';
  $$);
END$$;

-- Digital artifacts
DO $$
BEGIN
  PERFORM exec_if_table('public','order_files', $$
    DELETE FROM public.order_files WHERE created_at < now() - interval '7 days';
  $$);
  PERFORM exec_if_table('public','designs', $$
    DELETE FROM public.designs WHERE created_at < now() - interval '7 days';
  $$);
END$$;

-- Email logs
DO $$
BEGIN
  PERFORM exec_if_table('public','email_logs', $$
    DELETE FROM public.email_logs WHERE created_at < now() - interval '7 days';
  $$);
END$$;

-- Profiles for test users (auth users are removed via Admin API; this only clears profile rows older than 7 days and not in keep list)
DO $$
BEGIN
  IF to_regclass('public.user_profiles') IS NOT NULL THEN
    DELETE FROM public.user_profiles
    WHERE id IN (
      SELECT u.id
      FROM auth.users u
      WHERE u.email NOT IN ('admin@example.com','operator@example.com')
        AND u.created_at < now() - interval '7 days'
    );
  END IF;
END$$;

-- Optional: sequence reset examples (uncomment and adjust)
-- SELECT pg_catalog.setval(pg_get_serial_sequence('public.orders','id'), 1, false);


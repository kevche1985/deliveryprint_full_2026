Essential Supabase migrations for a minimal blank instance.

Included (standalone):
- 00000000000000_create_user_profiles_table.sql
- 20251125_create_system_settings.sql
- 20251125_create_services.sql
- 20260219_create_designs_bucket.sql

Not included due to dependencies on missing base tables (orders, products, categories, etc.):
- create_payment_settings.sql (references orders via payment_transactions)
- create_paypal_transactions.sql (references orders)
- 20260218_uploaded_files_checkout_sessions.sql (references orders/order_items)
- tenancy/indices/rls "step*" files touching orders/products
- add_foreign_keys.sql and various fix_* files that assume prior tables

Action required:
- Add base schema migrations for products, categories, orders, order_items, product_variants, product_images before applying dependent files.


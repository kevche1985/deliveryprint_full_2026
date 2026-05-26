Backup: Admin Web Customizer

Contents
- db/ SQL migrations to create and seed customization tables and web storage bucket
- code/ Next.js API routes and Admin page implementing the Web Customizer
- snippets/ Optional UI snippet to add an Admin menu link

How to import into another project
1) Database
   - Apply SQL files in this order:
     a) db/001_customization_tables.sql
     b) db/002_storage_web_bucket.sql
     c) db/003_seed_customization_keys.sql
   - These create `public.system_customization` (key/jsonb), optional `public.tenant_customization`, RLS policies for admin/operator, and the public `web` storage bucket with policies.

2) Server API (Next.js /app router)
   - Copy code/api/admin/customization/route.ts to /app/api/admin/customization/route.ts
   - Copy code/api/admin/customization/upload-logo/route.ts to /app/api/admin/customization/upload-logo/route.ts
   - Both expect a server-side Supabase client using the service role at `@/lib/supabase-server`.

3) Admin UI
   - Copy code/admin/customization/page.tsx to /app/admin/customization/page.tsx
   - Optional: add a menu item linking to "/admin/customization" (see snippets/navigation-link.tsx).

4) Header logo (optional live override)
   - To have the header pull `logo_url` at runtime, fetch `/api/admin/customization` on mount and prefer `json.logo_url` over any default env-based URL.

Notes
- The upload endpoint auto-creates the `web` bucket if it does not exist and returns a public URL.
- The save endpoint writes keys individually with a delete+insert strategy to avoid upsert edge cases.
- If your project has different auth/roles, adjust the RLS policies in 001_customization_tables.sql accordingly.


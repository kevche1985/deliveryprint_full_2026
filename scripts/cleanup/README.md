Instance Data Cleanup Plan

Parameters
- Keep users: admin@example.com, operator@example.com
- Cutoff window: 7 days (delete everything older than 7 days that matches rules)

Components
1) clean_instance.sql (database cleanup; transactional; safe checks)
2) clean_auth_and_storage.ts (auth users + storage cleanup; dry‑run by default)
3) params.json (centralized parameters consumed by the TS script)

Usage
0. Prereqs
   - Ensure .env.local points to the correct project (dzlqddocovzijnfwygap) and includes anon + service keys
   - Freeze writes (maintenance window)

1. Backup (required)
   - Database: use Supabase dashboard or pg_dump for the entire public schema
   - Storage: export buckets if you want an offline copy

2. Dry‑run auth/storage cleanup
   - From project root:
     - npx ts-node scripts/cleanup/clean_auth_and_storage.ts --dry-run
   - Review the manifest printed in the console

3. Apply auth/storage cleanup
   - npx ts-node scripts/cleanup/clean_auth_and_storage.ts --apply

4. Database cleanup
   - Open scripts/cleanup/clean_instance.sql in the Supabase SQL editor and execute it in sections
   - Each section begins with SELECT counts and then a DELETE block wrapped in a transaction

5. Post steps
   - Turn off maintenance mode and run smoke tests
   - Optionally reset sequences if desired (see the tail of clean_instance.sql)

Notes
- The SQL guards against missing tables using to_regclass checks
- The TS script relies only on official Supabase admin/list APIs and storage APIs
- Adjust params.json to change keep users or cutoff days


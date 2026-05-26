# White Label SaaS: Full App + DB Copy/Restore Guide

This document explains how to create a full “copy” of this web app and its Supabase backend so you can run it as a white-label SaaS.

There are two realistic approaches:

1) **Per-customer clone (recommended to start)**: one Supabase project + one deployment per customer/brand. Fastest path to production and simplest isolation.
2) **Single deployment, multi-tenant**: one Supabase project + one deployment for many brands. More efficient later, but requires deeper tenant-aware branding and stronger RLS discipline.

This guide focuses on **(1) per-customer clone**, and includes notes for (2) at the end.

---

## What You’re Copying

**App**
- Next.js app in this repository.
- Admin UI and APIs under `/app/admin` and `/app/api/admin`.

**Supabase**
- Postgres DB (tables, RLS policies, functions, views, triggers) defined in `supabase/migrations/*.sql`.
- Storage buckets used by the app:
  - `product-images`
  - `web-images`
  - `tenant-logos`
  - `quote-files`
  - `digital-products`
  - `order_files`
  - `designs`

---

## Prerequisites

**Local**
- Node.js + npm (or pnpm) to run/build the app.
- PostgreSQL client tools (`psql`, `pg_dump`, `pg_restore`).
- Optional for Storage mirroring: `awscli` (or `rclone`).

**Supabase**
- Access to the source project (for export).
- Permission to create a new Supabase project (for restore).

---

## Step 1 — Create a New Supabase Project (Target)

1) Create a new Supabase project.
2) Record the following values from the new project:
   - Project URL (for `NEXT_PUBLIC_SUPABASE_URL`)
   - `anon` key (for `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
   - `service_role` key (for `SUPABASE_SERVICE_ROLE_KEY`) — server-only
   - Database connection string (for DB restore scripts)

---

## Step 2 — Restore Database Schema (Migrations)

If you’re building a *fresh* white-label environment (recommended), apply the migrations instead of restoring a raw dump.

### Option A (recommended): Apply migrations in order

Run all SQL migrations against the new project DB.

**Mac/Linux example**

```bash
export DATABASE_URL="postgresql://postgres:<PASSWORD>@db.<PROJECT_REF>.supabase.co:5432/postgres"

for f in supabase/migrations/*.sql; do
  echo "Applying $f"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
done
```

Notes:
- Migrations are applied in lexicographic order (the filenames are timestamped to support this).
- If you have previously run migrations out of order in the source project, use the “full DB dump” approach instead.

### Option B: Apply selected migrations via Supabase SQL Editor

If you prefer the dashboard:
- Open SQL Editor → run each migration file content in order.
- Stop on any error; fix the root cause before continuing.

---

## Step 3 — Restore Data (Seed vs Full Copy)

### Option A (recommended for white label): seed only “baseline” data

Use the migrations (seeds included in some files) + then create:
- An admin user
- A tenant (if you use multi-tenant routes/admin tenancy)
- Baseline products/services as needed

This avoids migrating customers’ personal data and avoids auth complications.

### Option B: full DB copy (schema + data)

If you truly need an exact replica:

1) On the **source**, create a dump:

```bash
export SOURCE_DB_URL="postgresql://postgres:<PASSWORD>@db.<SOURCE_REF>.supabase.co:5432/postgres"
pg_dump --format=custom --no-owner --no-privileges --file=supabase_full.dump "$SOURCE_DB_URL"
```

2) On the **target**, restore:

```bash
export TARGET_DB_URL="postgresql://postgres:<PASSWORD>@db.<TARGET_REF>.supabase.co:5432/postgres"
pg_restore --dbname="$TARGET_DB_URL" --no-owner --no-privileges --clean --if-exists supabase_full.dump
```

Important cautions:
- Copying `auth` users is sensitive. For white-label SaaS you usually want a fresh user base.
- Restoring full dumps across Supabase projects can conflict with extensions, roles, and internal Supabase-managed schemas. If you hit issues, fall back to “migrations + seed” and migrate only the tables you truly need.

---

## Step 4 — Restore Supabase Storage (Buckets + Objects)

Database restore does not automatically restore Storage objects. You must copy bucket content.

### 4.1 Ensure buckets exist on the target

Buckets are created via migrations or manually in Supabase Storage UI. This repository includes migrations for some buckets (e.g. `designs`).

Double-check in Supabase Dashboard → Storage:
- `product-images`
- `web-images`
- `tenant-logos`
- `quote-files`
- `digital-products`
- `order_files`
- `designs`

### 4.2 Copy objects from source → target

Best approach is to use Supabase Storage’s S3-compatible endpoint with `aws s3 sync` (or `rclone`).

High-level steps:
1) Enable/obtain S3-compatible credentials for Storage in both projects (source and target).
2) For each bucket, sync from source to local, then local to target.

Example pattern (placeholders):

```bash
aws s3 sync "s3://<bucket>" "./storage/<bucket>" \
  --endpoint-url "https://<SOURCE_REF>.supabase.co/storage/v1/s3"

aws s3 sync "./storage/<bucket>" "s3://<bucket>" \
  --endpoint-url "https://<TARGET_REF>.supabase.co/storage/v1/s3"
```

Notes:
- Configure credentials separately per project.
- Repeat for each bucket listed above.
- If you don’t need to copy customer uploads, you can skip `order_files`, `designs`, and `quote-files`.

---

## Step 5 — Configure Auth + URLs (Required for Emails/Redirects)

In the Supabase Dashboard (target project):
- Auth → URL Configuration:
  - Site URL = your deployment URL
  - Add redirect URLs you use (e.g. local dev + production domain)

If you use email flows:
- Ensure `NEXT_PUBLIC_SITE_URL` matches your deployed site.

---

## Step 6 — Deploy a New Copy of the App

### 6.1 Create environment variables

In your deployment platform (e.g. Vercel), set at minimum:

**Supabase**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only; never expose to client)

**Site**
- `NEXT_PUBLIC_SITE_URL`

**Email (if enabled)**
- `RESEND_API_KEY`
- `EMAIL_FROM`

**Payments (optional)**
- `WOMPI_CLIENT_ID`
- `WOMPI_CLIENT_SECRET`
- `WOMPI_WEBHOOK_SECRET` (if validating Wompi signatures)
- `WOMPI_BASE_URL` (optional; defaults to Wompi)
- `NEXT_PUBLIC_PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_WEBHOOK_ID`

**AI (optional)**
- `OPENAI_API_KEY`

**Cron/maintenance (optional)**
- `CRON_SECRET`

**Branding (global, single-brand deployments)**
- `NEXT_PUBLIC_BRAND_NAME`
- `NEXT_PUBLIC_BRAND_SLOGAN`
- `NEXT_PUBLIC_BRAND_PRIMARY_COLOR`
- `NEXT_PUBLIC_BRAND_ACCENT_COLOR`
- `NEXT_PUBLIC_BRAND_LOGO_URL`
- `NEXT_PUBLIC_BANNER_IMAGE_URL`

### 6.2 Build and run

```bash
npm install
npm run build
npm run start
```

---

## Step 7 — Post-Restore Validation Checklist

1) **DB sanity**
- Admin pages load
- Orders can be created
- RLS doesn’t block required admin flows

2) **Uploads**
- Upload a design on Digital Printing → Add to Cart → confirm the file shows in `uploaded_files` and in Storage bucket `designs`.
- Create an order → confirm `order_items.design_file_url` is populated and downloadable.

3) **Payments**
- Verify provider configuration is present in `payment_settings`.
- Update webhook URLs to the new deployment domain (Admin → Payments).

4) **Email**
- Test email sending (Admin → Email Settings).

---

## Multi-Tenant Notes (Single Deployment for Many Brands)

This codebase already includes tenant concepts (tables + admin UI + `/t/[slug]` routes). To convert into a true white-label SaaS in a single deployment:

- Store per-tenant branding in DB (tenant table or settings table) instead of `NEXT_PUBLIC_*` env branding.
- Ensure every customer-facing query is tenant-scoped.
- Enforce tenant isolation via RLS across all tenant-owned tables.
- Avoid public buckets for tenant-private uploads unless you are comfortable with public URLs; prefer signed URLs for private assets.

A practical rollout plan:
1) Start with **per-customer clones** (fast).
2) Once product-market fit is proven, migrate to **single deployment multi-tenant** to reduce ops overhead.


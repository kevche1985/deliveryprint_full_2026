# Security Audit Report

Project: `delivery_2026` (Next.js App Router + Supabase)  
Date: 2026-03-15  
Prepared by: Cybersecurity review (code-level)

## Scope

- Codebase analysis (frontend + backend/API routes)
- API security (authn/authz, IDOR, rate limiting, CORS)
- Authentication & session security (Supabase auth usage)
- Database security (RLS, migrations, stored functions)
- Configuration & infrastructure (debug/test endpoints, security headers)
- Dependency & supply chain review (high-level)

## Executive Summary

The application contains multiple **Critical** issues that can lead to:

- Unauthenticated access to **admin data and privileged operations**
- **IDOR** and unauthenticated modification of orders/order items
- Unrestricted public file uploads (storage abuse / malware hosting)
- Payment status spoofing due to missing webhook signature verification
- Cost abuse and data integrity issues in AI generation routes

The recurring root cause is widespread usage of a **Supabase Service Role** client in API routes **without strict authentication and authorization guards**.

If exposed publicly, an attacker can likely:

- Read and exfiltrate **all orders** and **all users**
- Create users (and potentially set roles, depending on implementation)
- Attach items to arbitrary orders (IDOR)
- Upload arbitrary files to public storage
- Forge payment completion events via unverified webhooks

## Architecture Notes (High-Level)

- Frontend and API are implemented in Next.js App Router under `app/`.
- Supabase is used for:
  - Authentication
  - Database access
  - Storage uploads
- There is a server-side Supabase helper that uses Service Role:
  - `lib/supabase-server.ts`
- RBAC helper exists:
  - `lib/rbac.ts`
  - However, it is **not applied consistently** across admin routes.

## Findings (Prioritized)

### F1 — Unauthenticated Admin APIs (Critical)

**Impact:** Full data breach + privilege misuse.  
**Likelihood:** High.  

**Evidence (examples):**

- `GET /api/admin/orders` returns all orders without any auth checks:  
  - `app/api/admin/orders/route.ts`
- `GET/POST /api/admin/users` lists users and creates users via `supabase.auth.admin.*` without auth:  
  - `app/api/admin/users/route.ts`

**Why this is dangerous**

- These endpoints are reachable from the internet.
- They use powerful Supabase admin/service-role capabilities.

**Recommended fix**

- Require `requireRole(request, ["admin","operator"])` for all `/api/admin/*` routes.
- Ensure the authenticated user is derived from a server-validated session (cookie/session), not from request body.

---

### F2 — IDOR & Unauthenticated Writes: Orders and Order Items (Critical)

**Impact:** Attackers can create orders, modify order items, and potentially disrupt fulfillment.  
**Likelihood:** High.  

**Evidence (examples):**

- `POST /api/orders` accepts untrusted JSON and writes using a server client:  
  - `app/api/orders/route.ts`
- `POST /api/orders/[id]/items` can attach items to arbitrary order IDs:  
  - `app/api/orders/[id]/items/route.ts`

**Recommended fix**

- Require authentication for writing order data (or implement a separate, hardened guest-checkout design).
- Enforce ownership checks:
  - The caller may only mutate orders where `orders.user_id == auth.uid()`.
- Add input validation (Zod) + size limits.

---

### F3 — Unrestricted Public File Uploads (Critical)

**Impact:** Storage abuse, potential malware hosting, legal/policy risk.  
**Likelihood:** High.  

**Evidence (examples):**

- Unauthenticated upload endpoints storing to public bucket:  
  - `app/api/order-files/upload/route.ts`  
  - `app/api/uploads/design/route.ts`

**Recommended fix**

- Require auth and enforce ownership checks (user can only upload for their own orders/designs).
- Enforce:
  - MIME type allowlist (e.g., PNG/JPG/PDF only)
  - Maximum file size
  - Path normalization
- Make buckets private and use signed URLs for delivery.
- Add rate limiting (per IP/user).

---

### F4 — Payment Webhooks Not Authenticated (Critical)

**Impact:** Payment spoofing → free orders / unauthorized digital delivery.  
**Likelihood:** High.  

**Evidence (examples):**

- Wompi webhook handler does not validate signatures:
  - `app/api/webhooks/wompi/route.ts`
- Simulation route exists:
  - `app/api/webhooks/wompi/simulate/route.ts`

**Recommended fix**

- Verify webhook signature/HMAC (per provider docs).
- Disable simulation endpoints in production:
  - return 404 if `NODE_ENV !== "development"`
  - or require admin auth
- Treat webhook payload as untrusted; verify transaction status server-to-server with provider API before updating order state.

---

### F5 — AI Generation Endpoint (No Auth + User ID Trust) (Critical)

**Impact:** cost abuse + data integrity issues (write as another user).  
**Likelihood:** High.  

**Evidence:**

- `POST /api/ai/generate` accepts `userId` from the request body and writes with server privileges:
  - `app/api/ai/generate/route.ts`

**Recommended fix**

- Require authenticated user and derive `userId` from server session.
- Add rate limiting + abuse controls.
- Remove logging of entire request bodies (PII leakage risk).

---

### F6 — Service Role Overuse / RLS Bypass Risk (High)

**Impact:** Any missing authz check becomes catastrophic.  
**Likelihood:** High.  

**Evidence:**

- `lib/supabase-server.ts` uses Service Role key for database operations.

**Recommended fix**

- Prefer user-scoped server client for user actions.
- Use service role only for tightly controlled internal/admin operations with explicit authorization checks.

---

### F7 — Debug/Test Endpoints in Production (High)

**Impact:** information disclosure, expanded attack surface.  
**Likelihood:** Medium–High.  

**Evidence (examples):**

- `GET /api/debug` exposes environment config booleans and may include stack:
  - `app/api/debug/route.ts`
- Multiple `/api/test/*`, `/api/debug/*`, payment “test” endpoints appear under `app/api/`.

**Recommended fix**

- Remove them or guard them:
  - `if (process.env.NODE_ENV !== "development") return 404`
  - and/or require admin role

---

### F8 — Database Functions: SECURITY DEFINER Without EXECUTE Restrictions (High)

**Impact:** potential RLS bypass if callable by public roles.  
**Likelihood:** Medium.  

**Evidence:**

- Multiple `SECURITY DEFINER` functions:
  - `supabase/migrations/create_quote_functions.sql`

**Recommended fix**

- Explicitly restrict execution:
  - `REVOKE EXECUTE ON FUNCTION ... FROM PUBLIC;`
  - `GRANT EXECUTE ... TO <admin_role>;`
- Consider implementing checks inside the functions if they can be called by authenticated users.

---

### F9 — Weak CSP in Next.js Config (Medium)

**Impact:** Higher XSS exploitability in case of injection.  
**Likelihood:** Medium.  

**Evidence:**

- CSP includes `unsafe-inline` / `unsafe-eval`:
  - `next.config.mjs`

**Recommended fix**

- Remove `unsafe-eval` and `unsafe-inline` where possible.
- Use nonces/hashes for scripts in production.

---

### F10 — Build Safety Controls Disabled (Medium)

**Impact:** issues ship undetected; increases security risk over time.  
**Likelihood:** High (operational).  

**Evidence:**

- Build ignores ESLint and TypeScript errors:
  - `next.config.mjs`

**Recommended fix**

- Enable lint/typecheck in CI and production builds.

## SQL Injection Assessment

- Most database access uses the Supabase query builder (generally safe from classic SQL injection).
- The bigger risks are:
  - **Authorization failures (IDOR)**
  - **Service role misuse**
  - **SECURITY DEFINER functions** without EXECUTE restrictions

## Recommended Remediation Plan

### Phase 0 (0–48 hours) — Stop the bleeding

1. Protect all `/api/admin/*` routes with role checks.
2. Remove or hard-guard debug/test endpoints in production.
3. Implement webhook signature verification and disable simulation endpoints.
4. Require auth + ownership checks for uploads, orders, and order items.
5. Lock down AI generation endpoints with auth + rate limiting.

### Phase 1 (1–2 weeks) — Correct architecture

1. Replace service-role usage in user-facing routes with user-scoped server clients.
2. Ensure all tables have RLS enabled and policies enforce least privilege.
3. Add Zod validation and request size limits to every API route.
4. Add rate limiting for sensitive and expensive endpoints (payments, uploads, AI).

### Phase 2 (30 days) — Hardening & monitoring

1. Harden CSP (remove unsafe-inline/eval), add security headers consistently.
2. Add audit logging for admin actions, payment events, file uploads (PII redaction).
3. Add CI security checks (dependency scanning, secret scanning, SAST).

## Fix-First Checklist (Highest ROI)

1. **Admin API auth** (`/api/admin/orders`, `/api/admin/users`, etc.)
2. **Webhook verification** (Wompi) + disable simulation endpoints
3. **Upload restrictions** (auth + allowlists + private buckets)
4. **Orders/Items IDOR fixes** (ownership checks + validation)
5. **AI endpoint auth + rate limiting**


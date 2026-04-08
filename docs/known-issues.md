# BenefitsSafe Known Issues
## Last Updated: April 7, 2026

---

## Active Issues

### 1. Billing Checkout — Stripe Price ID Validation
- **Severity:** Medium
- **Status:** Open
- **Description:** Billing checkout at /settings/billing may fail if STRIPE_PRICE_* env vars don't match actual Stripe product prices. Error message now surfaces the real Stripe error instead of generic "Failed to create checkout session."
- **Impact:** Admins cannot upgrade subscription tier
- **Workaround:** Verify price IDs in Stripe Dashboard match Vercel env vars
- **Fix:** Confirm these match in Stripe Dashboard:
  - STRIPE_PRICE_SEED = price_1TIex01lmD1ohIWkZL5p7g39
  - STRIPE_PRICE_CORE = price_1TIJXj1lmD1ohIWkgbx8HvVD
  - STRIPE_PRICE_NETWORK = price_1TIf4i1lmD1ohIWkgjiDvtyh
  - STRIPE_PRICE_ENTERPRISE = price_1TIf5S1lmD1ohIWkZUK2zHyw

### 2. finance_officer Role — Not in Schema
- **Severity:** Low
- **Status:** Open
- **Description:** `finance_officer` is referenced in sidebar-data.ts but does not exist in the UserRole enum in Prisma schema. No test account exists.
- **Impact:** None currently — no user has this role
- **Fix:** Either add to Prisma schema or remove from sidebar-data.ts

### 3. billing_admin Role — Minimal Dashboard
- **Severity:** Low
- **Status:** Open
- **Description:** billing_admin role exists and has a sidebar defined (Billing & Plans, Organization, Profile) but the dashboard experience is minimal compared to other roles.
- **Impact:** Low — role is functional but sparse
- **Fix:** Enhance billing_admin dashboard when billing features mature

### 4. WowDash Template Image Warnings
- **Severity:** Low
- **Status:** Won't Fix
- **Description:** Next.js build shows warnings about `<img>` vs `<Image>` and image width/height in WowDash template components. These are cosmetic warnings from the template, not BenefitsSafe code.
- **Impact:** None — warnings only, no runtime errors
- **Fix:** Not worth the effort to fix template internals

### 5. Test Coverage Below 80%
- **Severity:** Medium
- **Status:** Open
- **Description:** Overall test coverage is 67% statements, 66% branches, 61% functions, 68% lines. Critical files like auto-approve.ts have 100% but cache.ts is at 18%.
- **Impact:** Some code paths untested
- **Fix:** Add tests for cache.ts Redis paths, API integration tests, and E2E tests

### 6. Health Check Response Time — 2.3 seconds
- **Severity:** Low
- **Status:** By Design
- **Description:** /api/health takes ~2.3 seconds because it actively checks database connectivity, Redis connectivity, and Stripe connectivity on every call.
- **Impact:** UptimeRobot shows 2.3s response time. This is the health check, not user-facing pages.
- **Fix:** Could add a lightweight /api/ping that just returns 200, but the thorough health check is more valuable for monitoring.

---

## Resolved Issues

### R1. Founder Login Crash — FIXED April 6, 2026
- JWT callback in auth.ts had no try-catch around org lookup
- Wrapped in try-catch with sensible defaults

### R2. Virtual Cards 500 Error — FIXED April 6, 2026
- Missing beneficiary relation on VirtualCard model
- Added Prisma relation + ran db push

### R3. 403 Errors for Non-Admin Roles — FIXED April 6, 2026
- 5 API routes only allowed nonprofit_admin + platform_admin
- Expanded role checks for all 12 roles

### R4. Duplicate React Key — FIXED April 6, 2026
- stock-report-card.tsx used g.name as key
- Changed to g.id

### R5. ApexCharts NaN — FIXED April 6, 2026
- y.toFixed() called without null check
- Added guard for undefined/null values

### R6. Sentry Not Capturing in Production — FIXED April 7, 2026
- Missing instrumentation.ts for Next.js 15
- Created instrumentation hook to load Sentry server config

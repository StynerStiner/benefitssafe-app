# BenefitsSafe Project Status Report
**Date:** April 2, 2026
**Author:** Development Session Log
**Purpose:** Complete handoff document for continuing work in new conversations

---

## WHAT IS BENEFITSSAFE

BenefitsSafe is a fintech grant disbursement platform for 501(c)(3) nonprofit organizations. It helps nonprofits manage restricted grant funds and disburse them to approved vendors on behalf of beneficiaries receiving SSI, SSDI, Medicaid, Medi-Cal, CalFresh, and IHSS benefits — without those beneficiaries losing their government benefits.

**Scale target:** 1.9M US nonprofits, unlimited beneficiaries and vendors.
**This is a bank-grade compliance product.** Every line of code matters.

---

## TECH STACK

| Layer | Technology | Details |
|-------|-----------|---------|
| Framework | Next.js 15.5.14 | App Router, TypeScript |
| UI | React 19+, Tailwind v4, shadcn/ui | WowDash template (DO NOT modify template styling) |
| Auth | NextAuth v5 | JWT sessions (1hr max, 15min refresh), Google + Microsoft OAuth + Credentials |
| Database | AWS Aurora PostgreSQL 17.7 | us-east-2, db.r7g.large, writer + reader, Multi-AZ |
| ORM | Prisma v7 | PrismaPg adapter (no `url` in datasource — uses adapter-based connections) |
| Payments | Stripe | Connect (Custom accounts), Treasury, Issuing |
| File Storage | AWS S3 | benefitssafe-uploads bucket |
| AI | Anthropic Claude | Compliance assistant |
| Monitoring | Sentry | Error tracking |
| Redis | Upstash | Rate limiting + caching (fallback to in-memory) |
| Email | Postmark | Transactional emails (not yet fully configured) |
| Hosting | Vercel | Next.js app |
| DNS | Cloudflare | benefitssafe.com |

---

## INFRASTRUCTURE — COMPLETED

### AWS (Account: StynerDev, 3140-1936-9313, us-east-2)

| Service | Status | Details |
|---------|--------|---------|
| **Aurora PostgreSQL** | DONE | Cluster: benefitssafe-db, 2 instances (writer us-east-2c, reader us-east-2b), deletion protection ON, backup retention 35 days, KMS encryption, Enhanced Monitoring, Performance Insights 465 days |
| **S3** | DONE | Bucket: benefitssafe-uploads, Block all public access ON, versioning ON, SSE-S3 encryption, server access logging ON |
| **CloudTrail** | DONE | Trail: benefitssafe-all-events, multi-region, SSE-KMS encryption (key: benefitssafe-cloudtrail-key), log file validation ON, SNS notifications ON |
| **Security Hub** | DONE | All capabilities enabled (threat analytics, vulnerability management, posture management), 30-day free trial active |
| **WAF** | N/A | Not needed — app hosted on Vercel which provides built-in DDoS/edge protection. WAF only protects CloudFront/ALB. |
| **Secrets Manager** | DONE | 6 secrets stored (see below) |

### AWS Secrets Manager Contents

| Secret Name | What It Stores |
|-------------|---------------|
| `benefitssafe-db-credentials` | Aurora PostgreSQL master password |
| `benefitssafe/auth-secret` | NextAuth AUTH_SECRET for JWT encryption |
| `benefitssafe/stripe-secret-key` | Stripe LIVE secret key (sk_live_...) |
| `benefitssafe/stripe-webhook-secret` | Stripe webhook signing secret (whsec_...) |
| `benefitssafe/encryption-key` | AES-256-GCM encryption key (64 hex chars) for lib/encryption.ts |
| `benefitssafe/aws-keys` | AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY for S3 |

### RDS Security Notes
- Security group has inbound 0.0.0.0/0 — this is the standard trade-off for Vercel + RDS (Vercel uses dynamic IPs that can't be whitelisted)
- Protection: SSL/TLS enforced, strong password, VPC, Internet access gateway disabled
- Connection string uses `sslmode=require`

### Stripe (Account: BenefitsSafe, acct_1THZmv1lmD1ohIWk)

| Item | Status |
|------|--------|
| Account activated | DONE (April 2, 2026) |
| Bank verified | DONE |
| Live secret key | Stored in Secrets Manager |
| Publishable key | Need to copy pk_live_... from Stripe Dashboard > Developers > API Keys |
| Webhook endpoint | DONE — https://benefitssafe.com/api/webhooks/stripe |
| Webhook signing secret | Stored in Secrets Manager (whsec_1ba61jThP4nac49uTOxYrKUHYzAde8vA) |
| Webhook events (15) | issuing_authorization (3), issuing_transaction (3), issuing_card (2), issuing_cardholder (2), charge (3), payment_intent (2) |
| Business type | Other financial institutions |
| Capabilities selected | Platform/Marketplace, Recurring payments, Card issuing, Identity verification, Financial services, Fraud protection |
| Treasury + Issuing | May require separate application/review from Stripe |

### DNS (Cloudflare — benefitssafe.com)

| Record | Status | Value |
|--------|--------|-------|
| SPF | DONE | `v=spf1 include:spf.mtasv.net include:_spf.google.com include:_spf.mx.cloudflare.net ~all` |
| DKIM | DONE | RSA key at cf2024-1._domainkey |
| DMARC | DONE | `v=DMARC1; p=reject; rua=mailto:dmarc@benefitssafe.com; pct=100` |
| A record | Set | 76.76.21.21 (Vercel) |
| CNAME www | Set | cname.vercel-dns.com |
| MX records | Set | Cloudflare email routing (route1/2/3.mx.cloudflare.net) |

---

## SECURITY HARDENING — COMPLETED

### 13 Launch Blocker Items

| # | Item | Status |
|---|------|--------|
| 1 | npm vulnerability audit | DONE — removed xlsx (replaced with papaparse), 5 remaining low-severity d3-color only |
| 2 | AWS CloudTrail | DONE |
| 3 | AWS Security Hub | DONE |
| 4 | **OWASP ZAP penetration test** | **INSTALLED (brew install --cask zap) — MUST RUN BEFORE LAUNCH** |
| 5 | AWS WAF | N/A (Vercel) |
| 6 | AWS Secrets Manager | DONE (6 secrets) |
| 7 | RDS Security Hardening | DONE |
| 8 | S3 Bucket Security | DONE |
| 9 | ENCRYPTION_KEY for production | DONE — generated, stored in Secrets Manager, lib/env-check.ts requires it in production |
| 10 | Incident Response Plan | DONE — docs/incident-response-plan.md |
| 11 | Privacy Policy (CCPA/CPRA) | DONE — app/privacy/page.tsx, 15 sections |
| 12 | Terms of Service | DONE — app/terms/page.tsx, 18 sections |
| 13 | Email DNS (SPF/DKIM/DMARC) | DONE — Cloudflare |

### OWASP ZAP — Pre-Launch Requirement

ZAP 2.17.0 is installed at `/Applications/ZAP.app`. Before any live deployment:

1. Start the dev server: `cd benefits-safe-app && npm run dev -- -p 3001`
2. Open ZAP from Applications (macOS may block it — go to System Preferences > Security & Privacy > Open Anyway)
3. Select "Automated Scan"
4. Target URL: `http://localhost:3001`
5. Click "Attack"
6. Review results — fix any HIGH or CRITICAL findings
7. Re-scan until 0 high-risk alerts

### Code-Level Security (Already Implemented)

| Security Measure | File(s) | What It Does |
|-----------------|---------|-------------|
| AES-256-GCM encryption | lib/encryption.ts | Encrypts sensitive fields at rest |
| Session fingerprinting | middleware.ts | Web Crypto API hash of IP+UserAgent, detects stolen sessions via bs-device-fp cookie |
| TOTP MFA | auth.ts + API routes | otplib-based MFA with encrypted backup codes |
| Rate limiting | lib/rate-limit.ts | Upstash Redis with in-memory fallback, login: 5/15min per email |
| OFAC screening | lib/ofac-screening.ts | Treasury API SDN list check before card issuance, 10s timeout, fail-open |
| MCC blocking (3 layers) | lib/mcc-controls.ts + webhook | Stripe spending controls + webhook enforcement + grant-level overrides |
| Email security | lib/email-security.ts | Disposable domain blocking, header injection prevention |
| S3 upload security | lib/s3-upload.ts | sanitizeFilename() for path traversal, private ACL, AES256 encryption |
| Org-scoped queries | All API routes | Every query filtered by organizationId (multi-tenant isolation) |
| IDOR protection | Fixed in 5 API routes | verify-eligibility, grants/document, virtual-cards/statement, notifications, grants/issue-card |
| CSP header | next.config.ts | Content-Security-Policy allowing self, Stripe.js, Sentry, S3 |
| Webhook signature | api/webhooks/stripe/route.ts | Enforced in production — rejects unsigned payloads |
| .npmrc hardening | .npmrc | ignore-scripts=true, audit=true, legacy-peer-deps=true |
| Env validation | lib/env-check.ts | ENCRYPTION_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET required in production |

### CCPA/GDPR Data Rights (Implemented)

| Endpoint | What It Does |
|----------|-------------|
| GET /api/user/data-export | Exports all user data (profile, grants, expenses, documents, cards, audit logs) as JSON |
| POST /api/user/data-deletion | Anonymizes PII, deactivates account, cancels virtual cards |

---

## DATABASE SCHEMA — KEY MODELS

Full schema at `prisma/schema.prisma`. Prisma v7 with PrismaPg adapter. Key models:

- **Organization** — tenant (stripeConnectAccountId, stripeFinancialAccountId)
- **User** — 12 roles, beneficiary fields (DOB, SSN last4, benefit programs), lastLoginIp/UserAgent/At, trustedDevices
- **Grant** — 3-party model (issuer/receiver/beneficiary), purpose, funderRequirements, approvedMCCs, blockedMCCs, whitelistedVendorIds
- **BudgetCategory** — per-grant budget lines
- **ExpenseRequest** — with compliance riskClassification
- **Vendor** — 3 types, 7 statuses
- **VirtualCard** — Stripe Issuing cards, cardLabel
- **Transaction** — card transactions
- **LedgerEntry** — IMMUTABLE restricted fund ledger
- **CardholderEligibility** — warrant, incarceration, drug trafficking, OFAC screening, eligibility status
- **CalendarEvent** — org-scoped calendar events
- **AuditLog** — IMMUTABLE activity log, userAgent field
- **Conversation/Message** — internal messaging
- **Notification** — system alerts
- **Document** — file attachments
- **DisbursementPolicy** — org-level payment rules

### Database Rules
1. LedgerEntry and AuditLog are IMMUTABLE — never update or delete
2. All money fields use Decimal(12,2)
3. Every write creates an AuditLog entry
4. All queries scoped by organizationId
5. Soft deletes only (archivedAt)
6. To run Prisma commands: use `--url` flag (e.g., `npx prisma db push --url "postgresql://..."`) because Prisma v7 doesn't use `url` in datasource block

---

## VIRTUAL CARD FLOW — ARCHITECTURE

### How Cards Get Created
1. Beneficiary submits expense request via dashboard
2. Nonprofit admin approves the expense
3. Admin clicks "Issue Card" on the approved expense or grant
4. System checks: CardholderEligibility (warrants, incarceration, drug convictions) + OFAC screening
5. System creates Stripe Issuing Cardholder (KYC) if not already exists
6. System creates Stripe Issuing Virtual Card with spending controls (amount limit + blocked MCCs)
7. Card appears in beneficiary's "My Cards" dashboard

### How Cards Get Funded (JIT — Just-In-Time)
1. Nonprofit connects bank account → funds transfer to Stripe Treasury Financial Account
2. When beneficiary uses card, `issuing_authorization.request` webhook fires
3. Webhook checks: grant balance, MCC allowed, eligibility status, amount within limit
4. If approved: webhook returns `{ approved: true }` and Stripe pulls funds from Financial Account
5. If declined: webhook returns `{ approved: false }` with decline reason, logged to audit

### MCC Blocking (3 Layers)
1. **Stripe spending controls** — set at card creation time (blocked_categories)
2. **Webhook enforcement** — `issuing_authorization.request` checks against grant-level blockedMCCs and BLOCKED_MCC_CODES
3. **Grant-level controls** — per-grant approvedMCCs and whitelistedVendorIds

### PCI Compliance
- Real cards: Stripe Elements with ephemeral keys (no card numbers touch our servers)
- Dev/mock cards: Fake number + CVC displayed with copy-to-clipboard
- Card reveal endpoint: api/virtual-cards/[id]/reveal/route.ts

---

## DASHBOARD PAGES — STATUS

### Wired to Real Data (DONE)
| Template Route | BenefitsSafe Page | Status |
|---|---|---|
| /(homes)/finance | Admin Dashboard | DONE — real grants, expenses, beneficiaries |
| /(homes)/project-management | Grants | DONE |
| /(homes)/ecommerce | Expenses | DONE |
| /(homes)/crm | Beneficiaries | DONE — eligibility verification, document uploads |
| /users-list | Vendors | DONE |
| /(homes)/nft | Virtual Cards | DONE — card detail dialog with reveal |
| /(homes)/sass | Subscriptions | DONE |
| /(homes)/analytics | Reports & Analytics | DONE |
| /(homes)/call-center | Audit Trail | DONE |
| /(homes)/cryptocurrency | Ledger & Transactions | DONE |
| /(homes)/booking | Disbursement Policies | DONE |
| /(homes)/inventory | Documents & Files | DONE |
| /users-grid | Team Management | DONE — real users from org |
| /chat | Messages | DONE — real conversations API |
| /(homes)/help | Support / Help Center | DONE |
| /(homes)/dashboard | Beneficiary Dashboard | DONE |
| /my-documents | Beneficiary Self-Upload | DONE |
| /company (org-settings) | Organization Settings | DONE — Stripe onboarding, fund balance, add funds |

### Still Need Work
| Page | What's Needed |
|------|--------------|
| /email (Notifications) | Needs real notification inbox UI |
| /calendar | Needs real events API wiring |
| /notification-alert | Alert preferences |
| /(homes)/lms | Onboarding & Training |
| Grant Compliance Dashboard | /grants/[id] detail page exists but needs polish |

---

## REMAINING DASHBOARD BUILD — CRITICAL ITEMS

### 1. Virtual Cards End-to-End Verification
- Verify cards actually generate with Stripe LIVE keys (not just test mode)
- Confirm beneficiaries can see full card details (number, CVC, expiry)
- Test a real transaction flow
- Verify JIT funding webhook works in production

### 2. Beneficiary ID Generation
- Each beneficiary needs a unique, collision-safe ID across the platform
- Format TBD (e.g., BS-ORG001-BEN0001 or UUID-based)
- ID must be unique even when same person is in multiple nonprofits

### 3. Multi-Org Beneficiary Data Isolation
- One beneficiary CAN exist in multiple nonprofit organizations
- Each nonprofit dashboard is PRIVATE — zero cross-org data leakage
- Beneficiary's grants, expenses, cards, documents in Org A must NEVER appear in Org B's dashboard
- Current schema uses organizationId on most models — verify this is consistently enforced
- Need to verify: if same email is used across orgs, are they treated as separate users or linked?

### 4. Calendar Page
- Wire to real CalendarEvent API (GET/POST /api/events, PATCH/DELETE /api/events/[id])
- Org-scoped events (each nonprofit sees only their own)

### 5. Messaging & Notifications
- Messages page is wired but needs testing
- Notifications inbox needs real-time notification display
- Email notifications via Postmark (not yet fully configured)

### 6. Role-Based Views (5 Portals)
- **Nonprofit Admin** — full access (mostly done)
- **Beneficiary** — My Dashboard, My Grants, My Expenses, My Cards, My Documents, Messages
- **Vendor** — Vendor Dashboard, Invoices & Payments
- **CPA/Auditor/Attorney** — Reports, Audit Trail, Compliance, Ledger, Documents (read-only)
- **Platform Admin** — God mode (all orgs, all users)
- Need to verify each portal shows correct sidebar nav and restricts data appropriately

---

## SHARED COMPONENTS BUILT

| Component | File | Purpose |
|-----------|------|---------|
| UserAvatar | components/shared/user-avatar.tsx | Real avatar or colored initials circle |
| ProfileDropdown | components/shared/profile-dropdown.tsx | Header dropdown with photo upload, real session data |
| MonthYearPicker | components/shared/month-year-picker.tsx | Professional date picker with current month indicator |
| PageDateFilter | components/shared/page-date-filter.tsx | Unified page-level date filtering |
| FormDatePicker | components/shared/form-date-picker.tsx | shadcn Calendar popover replacing native date input |
| ComplianceChat | components/ai/compliance-chat.tsx | Floating AI compliance assistant widget |

---

## KEY FILES

| File | Purpose |
|------|---------|
| auth.ts | NextAuth v5 config — Credentials + Google + Microsoft, JWT callbacks, MFA support |
| middleware.ts | Auth check, session fingerprinting, device tracking, public route whitelist |
| lib/encryption.ts | AES-256-GCM encrypt/decrypt with env-based key |
| lib/rate-limit.ts | Upstash Redis rate limiting with in-memory fallback |
| lib/mcc-controls.ts | Merchant category blocking per benefit program |
| lib/ofac-screening.ts | OFAC SDN sanctions screening |
| lib/email-security.ts | Email validation, disposable domain blocking |
| lib/s3-upload.ts | Secure S3 file upload with path traversal prevention |
| lib/permissions.ts | Role-based route permissions |
| lib/env-check.ts | Environment variable validation (production requirements) |
| lib/zod.ts | Zod validation schemas |
| app/api/webhooks/stripe/route.ts | Stripe webhook handler (JIT funding, MCC blocking, audit logging) |
| app/api/grants/[id]/issue-card/route.ts | Card issuance with eligibility + OFAC + KYC |
| app/api/org/stripe-onboarding/route.ts | Stripe Connect Custom account creation + Treasury |
| app/api/org/fund/route.ts | Treasury balance check + inbound transfer |
| docs/incident-response-plan.md | Full incident response plan |

---

## ENVIRONMENT VARIABLES

The .env.local file is at `/Users/stynerstiner/Downloads/Projects/benefits-safe-app/.env.local`.

For production, ALL secrets must come from AWS Secrets Manager — never from .env files on the server.

The .env.example at the project root documents all required and recommended variables.

lib/env-check.ts enforces these in production:
- DATABASE_URL (always required)
- NEXTAUTH_SECRET (always required)
- NEXTAUTH_URL (always required)
- ENCRYPTION_KEY (required in production)
- STRIPE_SECRET_KEY (required in production)
- STRIPE_WEBHOOK_SECRET (required in production)

---

## DEPLOYMENT CHECKLIST — PRE-LAUNCH

### Must Complete Before Any Live Deployment

- [ ] Run OWASP ZAP scan against dev server — fix all HIGH/CRITICAL findings
- [ ] Set all production env vars in Vercel from Secrets Manager values
- [ ] Copy Stripe pk_live_... publishable key to Vercel env vars
- [ ] Verify Stripe Treasury + Issuing are approved and active
- [ ] Test full virtual card flow end-to-end with live Stripe keys
- [ ] Test webhook receives and processes real Stripe events
- [ ] Verify all API routes enforce organizationId scoping (no cross-org data leakage)
- [ ] Run `./node_modules/.bin/tsc --noEmit` — 0 errors
- [ ] Run `npm audit` — 0 high/critical
- [ ] Verify HTTPS is working on benefitssafe.com (Vercel handles this)
- [ ] Test login flow (Credentials + Google + Microsoft)
- [ ] Test MFA enrollment and verification
- [ ] Test beneficiary self-upload documents
- [ ] Test data export (GET /api/user/data-export)
- [ ] Test data deletion (POST /api/user/data-deletion)

---

## PROJECT STRUCTURE NOTES

There are multiple folders in ~/Downloads/Projects/:

| Folder | Purpose | Edit? |
|--------|---------|-------|
| `benefits-safe-app` | **ACTIVE PROJECT** — the dashboard app | YES |
| `benefits-safe-app-main` | Main branch reference | Check CLAUDE.md for which is active |
| `wowdash-next-shadcn-typescript-main` | ORIGINAL TEMPLATE — untouched reference | **NEVER EDIT** |
| `benefits-safe-marketing` | Marketing website | Separate project |

**Dev server port:** 3001 (benefits-safe-app) or 3002 (benefits-safe-app-main)

---

## DESIGN RULES — NON-NEGOTIABLE

1. **NEVER change template fonts, sizes, colors, spacing, or CSS classes from WowDash**
2. No emojis in code — use Lucide icons instead
3. All components use the original template design as base
4. Only acceptable changes: add `"use client"`, add hooks, replace hardcoded data with fetched data, change text labels
5. No Bootstrap, jQuery, Firebase, MongoDB, Express.js, Pages Router, or `any` type

---

## ACCOUNTS AND ACCESS

| Service | Account |
|---------|---------|
| AWS | StynerDev (3140-1936-9313), adm.benefitssafe@gmail.com |
| Stripe | BenefitsSafe (acct_1THZmv1lmD1ohIWk), adm.benefitssafe@gmail.com |
| Cloudflare | Adm.projectshub@gmail.com |
| Google Cloud | adm.benefitssafe@gmail.com |
| Vercel | (check user's Vercel dashboard) |

---

*This document was generated on April 2, 2026 and reflects the state of the project at that time. Always verify current state by reading actual code and checking service dashboards.*

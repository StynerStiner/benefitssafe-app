# BenefitsSafe Deployment Notes
## Last Updated: April 7, 2026

---

## Current Production State

| Component | Value |
|-----------|-------|
| Production URL | https://benefitssafe.com |
| Vercel Project | benefits-safe-app |
| Git Branch | main (auto-deploy) |
| Database | benefitssafe-db (Aurora PostgreSQL 17.7, us-east-2) |
| Writer Endpoint | benefitssafe-db.cluster-c9m2ys8y0gk4.us-east-2.rds.amazonaws.com |
| Reader Endpoint | benefitssafe-db.cluster-ro-c9m2ys8y0gk4.us-east-2.rds.amazonaws.com |
| Redis Cache | golden-stag-91821.upstash.io |
| Stripe Mode | Live (with test products) |
| Sentry Project | javascript-nextjs |
| UptimeRobot | benefitssafe.com/api/health (5min checks) |

---

## Environment Variables (20+)

| Variable | Set In | Purpose |
|----------|--------|---------|
| DATABASE_URL | Vercel | Aurora writer connection |
| DATABASE_READ_URL | Vercel | Aurora reader connection |
| NEXTAUTH_SECRET | Vercel | JWT signing |
| AUTH_URL | Vercel | NextAuth callback URL |
| AUTH_TRUST_HOST | Vercel | Trust Vercel host |
| STRIPE_SECRET_KEY | Vercel | Stripe API |
| STRIPE_PUBLISHABLE_KEY | Vercel | Stripe client |
| STRIPE_WEBHOOK_SECRET | Vercel | Legacy webhook |
| STRIPE_BILLING_WEBHOOK_SECRET | Vercel | Billing webhook |
| STRIPE_CHARGES_WEBHOOK_SECRET | Vercel | Card charge webhook |
| STRIPE_PRICE_SEED | Vercel | $49/mo price ID |
| STRIPE_PRICE_CORE | Vercel | $99/mo price ID |
| STRIPE_PRICE_NETWORK | Vercel | $199/mo price ID |
| STRIPE_PRICE_ENTERPRISE | Vercel | $399/mo price ID |
| UPSTASH_REDIS_REST_URL | Vercel | Redis cache |
| UPSTASH_REDIS_REST_TOKEN | Vercel | Redis auth |
| ENCRYPTION_KEY | Vercel | AES-256-GCM |
| COMPOSIO_API_KEY | Vercel | Workflow automation |
| SENTRY_DSN | Vercel | Error tracking (server) |
| NEXT_PUBLIC_SENTRY_DSN | Vercel | Error tracking (client) |
| CRON_SECRET | Vercel | Cron job auth |

---

## Stripe Webhooks

| Webhook | URL | Events |
|---------|-----|--------|
| Billing | /api/webhooks/stripe-billing | 22 subscription/invoice events |
| Card Charges | /api/webhooks/stripe-charges | issuing_transaction.created |

---

## Cron Jobs

| Job | Schedule | Endpoint |
|-----|----------|----------|
| SentinelLayer Daily | 6am UTC daily | /api/cron/sentinel |
| Compliance Deep Scan | Every 6 hours | /api/cron/compliance |
| Weekly Grant Reports | Monday 7am UTC | /api/cron/reports |

---

## Test Accounts (All password: TestDev2024!)

| # | Email | Role | Dashboard |
|---|-------|------|-----------|
| 1 | admin@benefitssafe.com | nonprofit_admin | /dashboard |
| 2 | founder@benefitssafe.com | platform_admin | /platform |
| 3 | staff@benefitssafe.com | nonprofit_staff | /dashboard |
| 4 | beneficiary@benefitssafe.com | beneficiary | /my-dashboard |
| 5 | vendor@benefitssafe.com | vendor | /vendor-dashboard |
| 6 | auditor@benefitssafe.com | auditor | /audit-trail |
| 7 | cpa@benefitssafe.com | cpa | /reports |
| 8 | attorney@benefitssafe.com | attorney | /compliance |
| 9 | grantofficer@benefitssafe.com | grant_officer | /grants |
| 10 | compliance@benefitssafe.com | compliance_officer | /compliance |
| 11 | support@benefitssafe.com | support_agent | /support |
| 12 | billing@benefitssafe.com | billing_admin | /settings/billing |

---

## Deployment History

### April 7, 2026 — Infrastructure Build
- Data access layer (lib/data/index.ts)
- Redis caching via Upstash
- API rate limiting (3 tiers)
- Read replica routing (lib/db-read.ts)
- Sentry error tracking + email alerts
- UptimeRobot monitoring
- 3 SentinelLayer cron jobs
- 35 automated tests
- Structured logging (lib/logger.ts)
- Security headers (CSP, HSTS, X-Frame-Options)
- Env validation on startup
- Database indexes (7+ composite)
- Loading skeletons for all roles
- CORS configuration
- 27 demo pages removed
- HTTP cache headers
- 30s query timeout
- Schema documentation (docs/schema.md)

### April 6, 2026 — Platform Audit + Automation
- 3 automation gaps built (webhook, auto-approve, card linking)
- 7 bugs fixed (founder login, virtual cards 500, 403 errors, billing, duplicate keys, ApexCharts NaN)
- 12 roles expanded across 5 API routes
- Marketing site content updated (11 pages)
- 12 test accounts seeded
- Pricing tiers renamed (seed/core/network/enterprise)
- Sidebar icons (Lucide React)
- Stripe products + webhooks configured

### March-April 2026 — Core Platform Build
- Next.js 15 + Prisma v7 + Aurora PostgreSQL
- Stripe Connect + Issuing integration
- SentinelLayer autonomous agents
- Composio workflow automation
- OWASP ZAP security audit passed
- Multi-tenant architecture
- 13/13 ecosystem flows validated

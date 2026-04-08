# BenefitsSafe Operational Policies
## Last Updated: April 7, 2026

---

## Log Retention Policy

| Log Source | Retention | Location |
|------------|-----------|----------|
| Vercel function logs | 1 hour (free tier) | Vercel Dashboard |
| Sentry error events | 90 days | Sentry Dashboard |
| Aurora PostgreSQL logs | 7 days | AWS CloudWatch |
| Aurora slow query log | 7 days | AWS CloudWatch (when enabled) |
| UptimeRobot history | 90 days | UptimeRobot Dashboard |
| Git commit history | Unlimited | GitHub |
| Upstash Redis logs | 7 days | Upstash Console |

### Policy
- All production errors must be captured in Sentry (90-day retention)
- Structured logs (lib/logger.ts) output to console, captured by Vercel
- For extended log retention, upgrade Vercel plan or forward to CloudWatch Logs
- Audit logs (AuditLog model) are stored permanently in the database and are immutable
- Ledger entries (LedgerEntry model) are stored permanently and are immutable

---

## API Key Rotation Schedule

| Key | Rotation Frequency | Process |
|-----|-------------------|---------|
| NEXTAUTH_SECRET | Every 6 months | Generate new secret, update Vercel env var, redeploy |
| ENCRYPTION_KEY | Every 12 months | Generate new key, re-encrypt existing data, update env var |
| STRIPE_SECRET_KEY | When compromised | Rotate in Stripe Dashboard, update Vercel env var |
| STRIPE_WEBHOOK_SECRETS | When compromised | Create new webhook endpoint in Stripe, update env var |
| UPSTASH_REDIS_REST_TOKEN | When compromised | Rotate in Upstash Console, update Vercel env var |
| CRON_SECRET | Every 6 months | Generate new secret, update Vercel env var |
| SENTRY_DSN | Never (not a secret) | Public identifier, no rotation needed |

### Process for Key Rotation
1. Generate new key/secret
2. Update in Vercel → Settings → Environment Variables
3. Redeploy (Vercel → Deployments → Redeploy)
4. Verify via health check
5. Revoke old key in the source platform

---

## Deployment Policy

| Rule | Detail |
|------|--------|
| Deploy method | Auto-deploy on push to main |
| Pre-deploy checks | tsc --noEmit + vitest run must pass |
| Rollback method | Vercel → Deployments → Promote previous |
| Deploy notification | Sentry release tracking (automatic) |
| Post-deploy monitoring | 30 minutes active monitoring via Sentry |

---

## Incident Response

| Severity | Definition | Response Time | Escalation |
|----------|------------|---------------|------------|
| Critical | Site down, data loss, security breach | Immediate | Founder notified via UptimeRobot + Sentry |
| High | Major feature broken, 500 errors | Within 1 hour | Sentry alert to monitoring@ |
| Medium | Minor feature broken, degraded performance | Within 24 hours | Review in Sentry dashboard |
| Low | Cosmetic issues, warnings | Next sprint | Track in known-issues.md |

---

## Data Classification

| Data Type | Classification | Encryption | Access |
|-----------|---------------|------------|--------|
| Beneficiary PII (name, SSN) | Confidential | AES-256-GCM at rest, TLS in transit | Admin, Staff, Auditor (org-scoped) |
| Financial data (balances, transactions) | Confidential | Aurora encryption, TLS | Admin, Staff, CPA, Auditor (org-scoped) |
| Benefit program status | Sensitive | AES-256-GCM | Admin, Staff (org-scoped) |
| Grant details | Internal | Aurora encryption | Admin, Staff, Grant Officer (org-scoped) |
| Audit logs | Internal (immutable) | Aurora encryption | Admin, Auditor, CPA, Attorney, Compliance |
| User credentials | Confidential | bcrypt hash (never stored plaintext) | System only |
| Session tokens | Confidential | JWT signed with NEXTAUTH_SECRET | System only |
| API keys | Confidential | Vercel encrypted env vars | System only |

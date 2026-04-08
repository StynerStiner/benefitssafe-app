# BenefitsSafe Disaster Recovery Plan
## Last Updated: April 7, 2026

---

## Recovery Targets

| Metric | Target | Definition |
|--------|--------|------------|
| **RTO** (Recovery Time Objective) | **1 hour** | Maximum time to restore service after an outage |
| **RPO** (Recovery Point Objective) | **5 minutes** | Maximum data loss measured in time (Aurora continuous backups) |

---

## Infrastructure Components

| Component | Provider | Recovery Method | RTO |
|-----------|----------|----------------|-----|
| Application | Vercel | Instant rollback to previous deploy | < 1 min |
| Database (writer) | AWS Aurora PostgreSQL | Point-in-time restore | 15-30 min |
| Database (reader) | AWS Aurora PostgreSQL | Automatic failover to writer | < 2 min |
| Cache | Upstash Redis | Auto-rebuilds from DB on cache miss | < 1 min |
| DNS | Cloudflare | No action needed (99.99% SLA) | N/A |
| Payments | Stripe | No action needed (Stripe manages) | N/A |
| Monitoring | Sentry + UptimeRobot | No action needed | N/A |

---

## Disaster Scenarios

### Scenario 1: Application Crash (Bad Deploy)
- **Detection:** UptimeRobot alert + Sentry error spike
- **Recovery:** Vercel instant rollback (Deployments → Previous → Promote)
- **RTO:** < 1 minute
- **Data Loss:** None

### Scenario 2: Database Failure
- **Detection:** Health check returns "database: down" + UptimeRobot alert
- **Recovery:** Aurora automatic failover promotes reader to writer
- **RTO:** < 2 minutes (automatic)
- **Data Loss:** None (synchronous replication)

### Scenario 3: Database Corruption (Bad Migration)
- **Detection:** Application errors + data inconsistency reports
- **Recovery:** 
  1. Rollback application to pre-migration deploy
  2. Aurora point-in-time restore to before migration
  3. Update DATABASE_URL to restored cluster
  4. Redeploy
- **RTO:** 30-60 minutes
- **Data Loss:** Up to 5 minutes (RPO)

### Scenario 4: Redis Cache Failure
- **Detection:** Health check returns "redis: degraded"
- **Recovery:** Application auto-falls back to in-memory cache. No action needed.
- **RTO:** 0 minutes (automatic fallback)
- **Data Loss:** None (cache is ephemeral)

### Scenario 5: DNS/Cloudflare Outage
- **Detection:** Site unreachable from all locations
- **Recovery:** Wait for Cloudflare recovery (99.99% SLA) or switch DNS provider
- **RTO:** Depends on Cloudflare
- **Data Loss:** None

### Scenario 6: Stripe Outage
- **Detection:** Billing checkout fails, webhook errors
- **Recovery:** Wait for Stripe recovery. Card charges queue and retry.
- **RTO:** Depends on Stripe
- **Data Loss:** None (Stripe retries webhooks for 72 hours)

### Scenario 7: Complete AWS Region Failure (us-east-2)
- **Detection:** All services down
- **Recovery:**
  1. Create new Aurora cluster in us-east-1 from latest backup
  2. Update DATABASE_URL and DATABASE_READ_URL in Vercel
  3. Redeploy
- **RTO:** 1-2 hours
- **Data Loss:** Up to last backup interval

---

## Backup Schedule

| What | Frequency | Retention | Location |
|------|-----------|-----------|----------|
| Aurora automated backups | Continuous | 7 days | AWS us-east-2 |
| Aurora snapshots | Daily | 35 days | AWS us-east-2 |
| Git repository | Every push | Unlimited | GitHub |
| Vercel deployments | Every push | 100+ deploys | Vercel |
| Upstash Redis | N/A | Ephemeral cache | Upstash |

---

## Emergency Contacts

| Role | Email | Purpose |
|------|-------|---------|
| Founder | styner@benefitssafe.com | Decision authority |
| Monitoring | monitoring@benefitssafe.com | Alert destination |
| Security | security@benefitssafe.com | Security incidents |
| AWS Support | AWS Console | Infrastructure issues |
| Stripe Support | Stripe Dashboard | Payment issues |
| Vercel Support | Vercel Dashboard | Deployment issues |

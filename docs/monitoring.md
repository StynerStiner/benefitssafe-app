# BenefitsSafe Monitoring Setup

## UptimeRobot

- **URL**: `https://app.benefitssafe.com/api/health`
- **Interval**: 5 minutes
- **Alert contacts**: monitoring@benefitssafe.com
- **Checks**: Database connectivity, Redis connectivity, Stripe API reachability
- **Expected response**: `{ "status": "ok", "database": "connected", "redis": "connected" }`
- **Alert on**: HTTP status != 200, or response time > 10s

## Sentry

- **Project**: javascript-nextjs (BenefitsSafe)
- **DSN**: Set in `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` env vars
- **Alert rule**: "BenefitsSafe New Issue Alert"
- **Notifies**: monitoring@benefitssafe.com
- **Triggers**: Every new issue, 24hr interval (prevents alert storms)
- **Source maps**: Uploaded on build via `@sentry/nextjs` plugin
- **Coverage**: Client errors, server errors, edge middleware errors

## CloudWatch

- **Alarm**: `BenefitsSafe CPU High`
  - Threshold: > 80% CPU for 5 minutes
  - SNS Topic: `benefitssafe-alerts` -> monitoring@benefitssafe.com
  - Region: `us-east-2`

- **Alarm**: `BenefitsSafe Memory High`
  - Aurora manages memory via `db.r7g.large` instance (16GB RAM)
  - Alert: FreeableMemory < 2GB for 10 minutes

- **Alarm**: `BenefitsSafe Connections High`
  - Threshold: DatabaseConnections > 80 (RDS Proxy max ~100)
  - Indicates connection pool exhaustion

## Aurora PostgreSQL 17.7

- **Writer endpoint**: `benefitssafe-db.cluster-c9m2ys8y0gk4.us-east-2.rds.amazonaws.com`
- **Reader endpoint**: `benefitssafe-db.cluster-ro-c9m2ys8y0gk4.us-east-2.rds.amazonaws.com`
- **RDS Proxy**: `benefitssafe-proxy.proxy-c9m2ys8y0gk4.us-east-2.rds.amazonaws.com`
- **Instance**: `db.r7g.large` (2 vCPU, 16GB RAM)
- **Storage**: Auto-scaling (starts at 20GB, scales to 128TB)
- **Disk monitoring**: Aurora auto-scales storage. No manual disk alerts needed.
- **Slow query log**: Enabled, threshold > 1 second
- **Parameter group**: `benefitssafe-logging` with `log_min_duration_statement = 1000`

### Replication Lag

Aurora replication lag is typically < 20ms for same-AZ replicas.
Monitor via CloudWatch metric `AuroraReplicaLag` for `benefitssafe-db-instance-1-us-east-2b`.

- **Target**: < 100ms under normal load
- **Alert**: > 500ms sustained for 5 minutes
- **Action**: Check for long-running transactions or heavy write load

## QStash (Upstash)

- **Region**: US-EAST-1
- **Token**: Set in `QSTASH_TOKEN` Vercel env var
- **Retry policy**: 3 retries with exponential backoff
- **Monitoring**: Upstash dashboard at `console.upstash.com`
- **Fallback**: If QStash unavailable, jobs run synchronously via fetch()

## Upstash Redis

- **URL**: Set in `UPSTASH_REDIS_REST_URL` env var
- **Purpose**: Rate limiting, response caching, session fingerprinting
- **Fallback**: All Redis operations have try/catch fallbacks — app continues without cache

## Stripe

- **Webhook endpoints**:
  - `/api/webhooks/stripe` — JIT authorization + Connect events
  - `/api/webhooks/stripe-charges` — Card transaction + declined auth events
  - `/api/webhooks/stripe-billing` — Subscription lifecycle events
  - `/api/webhooks/stripe/fraud` — Fraud detection events
- **Monitoring**: Stripe Dashboard > Developers > Webhooks > Event logs
- **Alert**: Check for failed webhook deliveries daily

## Vercel

- **Project**: `benefits-safe-app`
- **Team**: `stynerdevs-projects-4cdd94f9`
- **Production URL**: `app.benefitssafe.com`
- **Build**: `prisma generate && next build`
- **Environment**: Production env vars set in Vercel dashboard

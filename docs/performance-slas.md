# BenefitsSafe Performance SLAs

## API Response Time Targets

| Endpoint Type | Target P95 | Target P99 | Notes |
|---|---|---|---|
| Health check (`/api/health`) | < 500ms | < 1s | Database + Redis + Stripe connectivity |
| Dashboard APIs | < 1s | < 2s | Aggregation queries across grants, expenses, cards |
| List endpoints (GET) | < 500ms | < 1s | Paginated, org-scoped, indexed queries |
| Detail endpoints (GET /[id]) | < 300ms | < 500ms | Single record lookup by PK |
| Write endpoints (POST/PATCH) | < 1s | < 2s | Includes validation, audit logging, notifications |
| Webhook processing | < 500ms | < 1s | Fast ack to Stripe; heavy work queued to QStash |
| Background jobs (QStash) | < 30s | < 60s | Compliance classification, auto-approve, ledger |
| JIT Authorization | < 2s | < 2s | HARD LIMIT — Stripe auto-declines if exceeded |

## Database Query Targets

| Query Type | Target | Notes |
|---|---|---|
| Indexed lookup | < 10ms | Primary key or indexed column |
| Org-scoped list | < 50ms | With organizationId in WHERE |
| Partitioned table scan | < 100ms | 16-bucket hash partition by orgId |
| Cross-table join | < 200ms | Grant + Expense + Category |
| Aggregation (COUNT/SUM) | < 500ms | Monthly totals, dashboard stats |

## Uptime Targets

| Component | Target | Monitoring |
|---|---|---|
| API availability | 99.9% | UptimeRobot (5-min interval) |
| Database availability | 99.95% | Aurora Multi-AZ |
| Stripe webhook delivery | 99.99% | Stripe dashboard |
| Background job completion | 99.5% | QStash retry (3x) |

## Image/Asset Optimization Status

77 images exceed 100KB in `public/`. Key offenders:

| Category | Count | Total Size | Priority |
|---|---|---|---|
| Logo variations (5-13MB each) | 12 | ~80MB | HIGH — compress to < 200KB |
| Full-logos drafts | 8 | ~25MB | HIGH — remove unused, compress rest |
| NFT card backgrounds | 2 | ~7MB | MEDIUM — compress to < 500KB |
| Error/carousel pages | 8 | ~3.5MB | LOW — template defaults |
| Gallery images | 12 | ~1.6MB | LOW — template defaults |

**Recommendation**: Run `sharp` or `squoosh` to compress all logos to WebP < 200KB.
Current total: ~120MB in oversized images. Target: < 5MB total.

## Benchmark Script

Run: `npx tsx scripts/benchmark-api.ts`

Measures min/max/avg/P95/P99 across 10 iterations per endpoint.
Flags any endpoint exceeding 1s P95 as needing optimization.

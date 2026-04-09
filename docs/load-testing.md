# BenefitsSafe Load Testing Guide

## Prerequisites

- Install k6: `brew install k6`
- Start dev server: `npm run dev -- -p 3001`
- Ensure test account exists: `admin@benefitssafe.com / TestDev2024!`

## Run smoke test (quick, 30 seconds, 10 users)

```bash
npm run load-test:smoke
# or directly:
k6 run scripts/load-test-smoke.js
```

## Run full load test (5.5 minutes, up to 100 users)

```bash
npm run load-test
# or directly:
k6 run scripts/load-test.js
```

## Run against staging/production (use with caution)

```bash
k6 run -e BASE_URL=https://app.benefitssafe.com scripts/load-test-smoke.js
```

## Performance SLAs

| Metric | Target | Notes |
|--------|--------|-------|
| P95 response time | < 2 seconds | Across all endpoints |
| P99 response time | < 5 seconds | Allows for cold starts |
| Error rate | < 5% | Include auth failures |
| Health check P95 | < 500ms | Unauthenticated |
| Dashboard P95 | < 1s | Aggregated data |
| Grants/Expenses P95 | < 500ms | Paginated lists |

## Load Profile

The full test simulates a Monday morning scenario:

| Phase | Duration | Virtual Users | Simulates |
|-------|----------|---------------|-----------|
| Ramp up | 30s | 0 -> 10 | Early morning logins |
| Steady | 1m | 10 -> 50 | Normal usage |
| Peak | 2m | 50 | Sustained load |
| Spike | 30s | 50 -> 100 | Spike (all orgs online) |
| Sustained spike | 1m | 100 | Heavy load |
| Ramp down | 30s | 100 -> 0 | End of rush |

## Custom Metrics

- `health_latency` — Health check response time
- `dashboard_latency` — Dashboard API response time
- `grants_latency` — Grants list response time
- `errors` — Failed request rate

## Interpreting Results

```
http_req_duration...: avg=245ms  min=12ms  med=198ms  max=3.2s   p(95)=890ms  p(99)=1.8s
```

- **avg**: Average response time across all requests
- **p(95)**: 95th percentile — 95% of requests complete within this time
- **p(99)**: 99th percentile — only 1% of requests are slower
- **errors**: Percentage of failed checks

## Scale Projections

| Nonprofits | Concurrent Users | Expected P95 |
|------------|-----------------|-------------|
| 100 | 10-20 | < 500ms |
| 1,000 | 50-100 | < 1s |
| 10,000 | 500-1,000 | < 2s (with Aurora read replicas) |
| 100,000 | 5,000-10,000 | Requires horizontal scaling |

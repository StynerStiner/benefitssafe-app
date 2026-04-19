# Load Baselines

> Ledger of measured p50 / p95 / p99 latencies for the top-5 user-facing BenefitsSafe endpoints, captured via the zero-dep load-test runner. Baselines let us detect regressions at deploy time instead of waiting for user complaints.
>
> Companion to [`scripts/loadtest/run-load-test.mjs`](../../scripts/loadtest/run-load-test.mjs) and [`docs/runbooks/quarterly-game-day.md`](./quarterly-game-day.md).

---

## 1. When to record a new baseline

Take a fresh baseline after:

- Any major architectural change (new ORM extension, new middleware, new cache layer).
- Any migration that rewrites a hot table (expenses, grants, auditlog).
- Any dependency bump that affects the request path (Next.js, Prisma, `@upstash/redis`, `pg`).
- Any infra shift (Aurora version upgrade, Redis plan change, Vercel runtime bump).
- Any P3 promotion — capture baseline against the new stable to reset the regression yardstick.

A quarterly "refresh baseline" run is recommended even in the absence of changes, to catch slow drift (e.g., table growth).

## 2. How to record a baseline

Run the load test against staging (or production during an off-peak approved window):

```bash
# Staging, auth via copied session cookie:
AUTH_COOKIE="next-auth.session-token=..." \
BASE_URL="https://staging.benefitssafe.com" \
  node scripts/loadtest/run-load-test.mjs --baseline > baseline.jsonl

# Summary lines are on stderr; JSON lines are in baseline.jsonl.
```

Then paste the stderr summary block into the ledger table below, with the date, git SHA, and environment prefixed. Commit the change to this file.

For stress-run numbers (50 concurrent × 300s), use `--stress` instead — capture both columns when available so the regression policy can check either.

## 3. Regression policy

Each new measurement is compared against the most recent baseline in the same environment:

| Signal | Alert | Action |
|---|---|---|
| p50 latency | > 1.2× baseline | Open investigation ticket |
| p95 latency | > 1.3× baseline | Open investigation ticket, tag performance label |
| p99 latency | > 1.5× baseline | **Block deploy** until investigated |
| Error rate | > 1% absolute | **Block deploy** until investigated |

"Block deploy" means: do not run `promote-canary-to-stable.yml` while the regression is outstanding. Fix or revert first.

Regression investigation lives in `docs/postmortems/` when it ships. Until then, use the Better Stack comparison dashboard to identify which endpoint regressed and whether the regression correlates with a specific deploy SHA.

## 4. Baseline ledger

Most recent baselines at the top. One block per run. Keep ≥4 baselines (a year of quarterly refreshes) for long-term trend comparison.

### Template — copy this block for each new run

```
### <YYYY-MM-DD> — <env> — <mode> — <git SHA>

Operator: @<github handle>
BASE_URL: <full URL>
Mode: --baseline | --stress
Concurrency × duration: 10 × 60s | 50 × 300s

  endpoint                | count  | p50      | p95      | p99      | error%
  --------------------------------|--------|----------|----------|----------|-------
  /api/dashboard          | <n>    | <ms>     | <ms>     | <ms>     | <%>
  /api/grants             | <n>    | <ms>     | <ms>     | <ms>     | <%>
  /api/beneficiaries      | <n>    | <n/a>    | <n/a>    | <n/a>    | <%>
  /api/notifications      | <n>    | <ms>     | <ms>     | <ms>     | <%>
  /api/expenses           | <n>    | <ms>     | <ms>     | <ms>     | <%>

Notes:
  - <anything noteworthy — Aurora was warm/cold, cache prepopulated, etc.>
```

### First baseline — pending

No baseline has been recorded yet. First baseline lands when P3b completes (staging canary + stable are live) and the operator runs `--baseline` against both channels.

## 5. Running against canary (once P3b is live)

Canary's 10% traffic is a live load-test signal. For a formal canary baseline, point the runner at the canary origin directly:

```bash
AUTH_COOKIE="..." \
BASE_URL="https://canary.benefitssafe.com" \
  node scripts/loadtest/run-load-test.mjs --baseline > canary-baseline.jsonl
```

The result should be within regression tolerance of the stable baseline. If canary is measurably slower, the promotion workflow should NOT fire until the regression is understood.

## 6. Running against production — gated

Production load testing is **not a routine activity**. It is scheduled in advance with the following preconditions:

- Off-peak window (typically 22:00–04:00 Pacific).
- `--baseline` mode only; `--stress` is **never** permitted against production.
- Concurrency cap: 10 workers maximum (the default for `--baseline`).
- Second operator on-call during the run for observability.
- Run duration bounded to 60 seconds.
- DegradedBanner monitored — if the P2 degraded-mode trigger fires during the run, abort immediately.

If any of the above is not met, the run is a policy violation. Cancel and reschedule.

## 7. See also

- [`scripts/loadtest/run-load-test.mjs`](../../scripts/loadtest/run-load-test.mjs) — the runner itself.
- [`docs/runbooks/quarterly-game-day.md`](./quarterly-game-day.md) — the playbook that exercises these baselines under chaos conditions.
- [`docs/runbooks/canary-alert-rules.md`](./canary-alert-rules.md) — Rule 2 (canary p95 divergence) uses the regression policy above as its baseline.
- [`docs/design-notes/bsrs-ch08-p3-design.md`](../design-notes/bsrs-ch08-p3-design.md) §6 — the observability tagging that makes per-channel baselines possible.
- Legacy k6 scripts `scripts/load-test.js` + `scripts/load-test-smoke.js` — advanced throttling if an operator prefers k6. Install the k6 binary to use them.

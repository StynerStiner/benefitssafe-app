# Quarterly Game Day Playbook

> BSRS Ch 8 P5 — quarterly fault-injection exercise. 2-hour time-box, three scenarios, two operators: one injects while the other executes the matching runbook. Each run produces a scored pass/fail and at least one actionable improvement.
>
> Companion to [`docs/runbooks/canary-alert-rules.md`](./canary-alert-rules.md), [`docs/runbooks/failure-domain-failover.md`](./failure-domain-failover.md), [`docs/runbooks/expand-contract-migrations.md`](./expand-contract-migrations.md), and [`docs/design-notes/bsrs-ch08-resilience-applied.md`](../design-notes/bsrs-ch08-resilience-applied.md) §P5.

---

## 0. Before the game day

**One week before:**

- Book the 2-hour block on both operators' calendars. One scenario per ~30 minutes, with buffer for postmortem discussion.
- Confirm the target environment — staging is the default. Production-like load is ideal but staging is sufficient for scenario pass/fail.
- Confirm the P3b canary/stable split is live in staging (Scenario C requires it). If P3b is not live, substitute a second run of Scenario A or B.
- Confirm the operator executing the runbook has read the three companion docs end-to-end. This is not the time to read them for the first time.
- Confirm `CHAOS_ENABLED=true` is **not** set in any production shell — verify via `grep CHAOS_ENABLED ~/.zshrc ~/.bashrc` etc.

**Day of, 10 minutes before start:**

- Open Better Stack comparison dashboard.
- Open Sentry "releases" view filtered by `bs@<channel>-*`.
- Open a fresh terminal with `CHAOS_ENABLED=true` exported for the injection operator.
- Start a shared notes doc — one heading per scenario, one bullet per observable.

---

## 1. Scenario A — Aurora degraded

**Exercises:** P2a write-gate (`assertDbHealthy()`), P2c stale-cache reads (`cachedWithStaleness`), DegradedBanner client UX.

### 1a. Preconditions

- Staging environment, operator has AWS RDS console access (or `CHAOS_ENABLED=true` for flag-file alternative).
- `/api/health` polled by DegradedBanner client-side.
- 5 browser tabs open for the verification step: dashboard, grants list, create-grant form, expense list, create-expense form.

### 1b. Injection (pick ONE)

**Option 1 — authentic (preferred):** AWS RDS Console → select the cluster → Actions → **Stop**. Aurora pauses within ~60 seconds. This is the most realistic scenario; the app sees identical symptoms to a real outage.

**Option 2 — flag file + P5b:** `CHAOS_ENABLED=true CHAOS_AURORA_LATENCY_MS=5000 node scripts/chaos/aurora-slow.mjs --on`. Requires the P5b middleware that reads `/tmp/bs-chaos-aurora.json` on every Prisma call. If P5b is not shipped, this option no-ops — fall back to Option 1 or 3.

**Option 3 — manual latency:** `tc qdisc add dev eth0 root netem delay 5000ms` on the staging box (requires sudo). Removes itself on reboot but has broader blast radius than needed.

### 1c. Expected observable behavior

Within 30 seconds of injection:
- `/api/health` returns `{"status":"down","checks":{"database":{"status":"down", ...}}}` — 503 response.
- DegradedBanner client-side component becomes visible on every authenticated tab.
- Every write route (`POST /api/grants`, `POST /api/expenses`, etc.) returns 503 with `{"error":"...", "kind":"dependency_unavailable", "retryAfterSeconds":...}`.
- Every P2c-retrofitted GET returns either fresh data (on the first hit if cache was cold) or stale data with `X-Data-Staleness` header + `_meta.stale=true` envelope on subsequent hits.
- Redis health still green (the chaos is Aurora-specific).

### 1d. Verification

Execute in the 5 open tabs:
1. Try to create a grant → expect 503 + Retry-After header.
2. Try to create an expense → expect 503.
3. Read dashboard → expect stale data envelope OR 503 `dependency_unavailable` if cache cold.
4. Read grants list → same.
5. Read `/api/health` in a terminal: confirm `deploy_channel` field + `status: "down"`.

Confirm via dashboard panels:
- 5xx rate spikes on write routes.
- GET routes return mix of 200 (stale) and 503 — not all 5xx, not all 2xx.
- No Stripe circuit openings (this is not a Stripe scenario).

**Pass:** every symptom above observed, no crashes, DegradedBanner appears on every tab. **Fail:** any write succeeds during the injection, any retrofitted GET returns raw 504 without the degraded-mode envelope.

### 1e. Rollback

- Option 1: RDS Console → cluster → Actions → **Start**. Resume time ~60 seconds.
- Option 2: `CHAOS_ENABLED=true node scripts/chaos/aurora-slow.mjs --off`.
- Option 3: `tc qdisc del dev eth0 root netem`.

After rollback, confirm `/api/health` returns `"status":"ok"` within 60 seconds. Confirm DegradedBanner disappears. Confirm a fresh write succeeds.

### 1f. Record and follow up

- Time-to-detect (injection → first alert): target ≤ 60s.
- Time-to-verify-degraded-mode (alert → all expected symptoms confirmed): target ≤ 3 min.
- Time-to-recover (rollback → healthy): target ≤ 2 min post-rollback.
- Any deviations from expected behavior → open a ticket.

---

## 2. Scenario B — Stripe down

**Exercises:** P1 Stripe circuit breaker ([`lib/stripe-circuit.ts`](../../lib/stripe-circuit.ts)), cascading-failure prevention.

### 2a. Preconditions

- Staging environment, P1 circuit breaker deployed (shipped in `4fc087a` per scorecard).
- An approvable expense request already in the database (seed it beforehand).

### 2b. Injection (pick ONE)

**Option 1 — flag file + P5b:** `CHAOS_ENABLED=true node scripts/chaos/stripe-down.mjs --on`. Requires P5b integration in `lib/stripe-circuit.ts` that reads `/tmp/bs-chaos-stripe.json`. If P5b is not shipped, fall back to Option 2.

**Option 2 — env var corruption:** On the staging Vercel deployment, change `STRIPE_SECRET_KEY` to `sk_test_invalid`. Next cold Lambda picks up the change. Stripe calls fail with authentication errors, circuit opens after the configured error rate threshold.

**Option 3 — DNS block:** Add `0.0.0.0 api.stripe.com` to `/etc/hosts` on the staging box. Stripe calls hit connection-refused, circuit opens.

### 2c. Expected observable behavior

Within ~30 seconds of injection + a few client requests:
- Better Stack shows `event:"stripe_circuit_open"` log lines filtered by `deploy_channel`.
- Routes using Stripe (`POST /api/expenses/[id]/approve`, `POST /api/grants/[id]/issue-card`, `POST /api/virtual-cards/[id]/close`, `POST /api/billing/checkout`) return 503 with `kind: "dependency_unavailable"` and a clear Stripe-attributed message.
- **Critical invariant:** unrelated routes (`/api/grants`, `/api/dashboard`, `/api/notifications`, `/api/expenses` GETs) continue to return 200. This is the cascading-failure prevention assertion — Stripe being slow must not exhaust Vercel function concurrency on unrelated paths.

### 2d. Verification

1. Attempt to approve the seeded expense → expect 503 `dependency_unavailable`.
2. List grants → expect 200 with normal data.
3. Read dashboard → expect 200 with normal data.
4. Check Better Stack logs filtered by `event:"stripe_circuit_open"` → expect ≥1 entry tagged with the right `deploy_channel`.
5. Verify no novel Sentry errors under unrelated routes (look for `release:bs@...` filtered by `release`).

**Pass:** Stripe routes 503, unrelated routes 200, circuit-open events visible. **Fail:** any unrelated route returns 500 or 504 (cascading-failure regression), or Stripe routes return 500 instead of structured 503.

### 2e. Rollback

- Option 1: `CHAOS_ENABLED=true node scripts/chaos/stripe-down.mjs --off`.
- Option 2: Restore `STRIPE_SECRET_KEY` on Vercel, redeploy or wait for next cold Lambda.
- Option 3: Remove the `/etc/hosts` entry.

Wait for the circuit-breaker cooldown window (~30s default per P1 config) and confirm a Stripe route succeeds again.

### 2f. Record and follow up

- Time-to-detect (injection → first circuit-open event): target ≤ 30s.
- Cascading-failure check: % of unrelated-route requests that returned non-2xx during the window. Target: 0%.
- Circuit auto-close latency (rollback → circuit closed): target ≤ 60s.

---

## 3. Scenario C — Bad canary deploy

**Exercises:** P3 failover runbook, P3c observability tagging, P3d promotion workflow's role as the release gate.

### 3a. Preconditions

- P3b is live: canary + stable channels provisioned via Cloudflare LB (10/90 weights), canary serving traffic, comparison dashboard populated with recent data.
- The injection operator has write access to `main` but NOT to `stable` (branch protection via P3a).
- [`docs/runbooks/failure-domain-failover.md`](./failure-domain-failover.md) open on the runbook operator's screen.

**If P3b is NOT live, skip this scenario** and run a repeat of A or B instead. Record the skip.

### 3b. Injection

Merge a commit to `main` that introduces a synthetic regression on a single hot endpoint — e.g., add an unconditional `throw new Error("chaos — game day")` at the top of `GET /api/grants`. Keep the regression behind a feature flag (`process.env.CHAOS_GAME_DAY === "true"`) so it only fires on the canary deployment (where the env var is set in Vercel for this game-day window).

Vercel auto-deploys `main` → canary. Wait ~2 minutes for Cloudflare LB propagation.

### 3c. Expected observable behavior

Within ~5 minutes of canary going live:
- Canary 5xx rate rises on `/api/grants`. Rule 1 alert fires (`canary > 1.5× stable` in 5-min window).
- Sentry release `bs@canary-<sha>` accumulates novel errors — Rule 4 alert fires.
- Stable remains healthy (stable release tag unaffected).
- Dashboard Panel A (5xx rate) shows a sharp divergence between the two channels.

The runbook operator starts the [`failure-domain-failover.md`](./failure-domain-failover.md) flow from §1 Detect.

### 3d. Verification

Time-box the runbook operator to **30 minutes total** from alert-fire to rollback complete:
1. They should reach §3 Rollback canary within 10 minutes.
2. They should execute the Cloudflare LB API call to set canary weight to 0.
3. Edge propagation completes within ~60 seconds of the API call.
4. Request volume to the canary origin drops to zero in Panel C.
5. `curl https://benefitssafe.com/api/health` now returns `deploy_channel: "stable"` reliably (run 10× to confirm).

**Pass:** rollback complete within 30 minutes, 5xx rate returns to baseline, 100% of traffic on stable, postmortem drafted within 1 week. **Fail:** rollback exceeds 30 minutes, any user-visible partial brokenness after "rollback complete," or the runbook had a dead-end step.

### 3e. Rollback

- Cloudflare LB: canary weight → 0 (the failover runbook's §3 step).
- After the exercise: `git revert <chaos-sha>` on main, Vercel auto-redeploys a clean canary, restore weight to 0.1 after the new canary passes smoke tests.
- Remove the `CHAOS_GAME_DAY` env var from the Vercel deployment.

### 3f. Record and follow up

- Mean time to acknowledge (alert fire → operator opens runbook): target ≤ 5 min.
- Mean time to repair (alert fire → rollback complete): target ≤ 15 min; hard limit 30 min.
- Any step in the runbook that was ambiguous or incorrect → file an issue against the runbook the same day.
- Postmortem is required for every game day Scenario C run — even "perfect" runs surface latent improvements in the runbook.

---

## 4. Cross-scenario invariants

Regardless of which scenario runs, these must all hold at the end of the game day:

- **Audit log completeness:** every action the runbook operator took (rollback, env changes, deploys) has a corresponding `AuditLog` or `deploy_promotion` / `canary_rollback` entry.
- **Ledger integrity:** `SELECT COUNT(*) FROM "LedgerEntry"` before and after each scenario must match unless the scenario deliberately created ledger entries. No ledger rows deleted or modified.
- **No production impact:** staging traffic only. If a scenario accidentally touched production, stop immediately, write an incident report, and that's the game day — no further scenarios.
- **CHAOS_ENABLED cleanup:** after all scenarios, every operator confirms `CHAOS_ENABLED` is unset in their shell. Verify with `echo "CHAOS_ENABLED=${CHAOS_ENABLED:-unset}"`.

---

## 5. Scoring and follow-up

After all three scenarios:

- Write up a 1-page summary in `docs/postmortems/game-day-<YYYY-MM-DD>.md` with per-scenario pass/fail, measured times, and at least one specific improvement per scenario.
- File action-item tickets for any improvement that requires code or doc changes. Tag them `game-day:<YYYY-MM-DD>`.
- Schedule the next quarter's game day before ending the current one — calendar inertia is the #1 reason P5 drifts from "quarterly" to "annually."

---

## 6. See also

- [`docs/design-notes/bsrs-ch08-resilience-applied.md`](../design-notes/bsrs-ch08-resilience-applied.md) §P5 — the P-inventory rationale for why P5 matters.
- [`docs/runbooks/failure-domain-failover.md`](./failure-domain-failover.md) — Scenario C's runbook, verbatim.
- [`docs/runbooks/canary-alert-rules.md`](./canary-alert-rules.md) — the alerts that fire during Scenario C.
- [`docs/runbooks/expand-contract-migrations.md`](./expand-contract-migrations.md) — relevant when Scenario C involves a schema change.
- [`scripts/chaos/aurora-slow.mjs`](../../scripts/chaos/aurora-slow.mjs) + [`scripts/chaos/stripe-down.mjs`](../../scripts/chaos/stripe-down.mjs) — the injection toggles.
- [`scripts/loadtest/run-load-test.mjs`](../../scripts/loadtest/run-load-test.mjs) — run `--baseline` before and after each scenario to capture observable latency impact.
- [`docs/runbooks/load-baselines.md`](./load-baselines.md) — where to record regression data observed during a game day.

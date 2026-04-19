# Canary Alert Rules + Comparison Dashboard

> Operator-configured alert rules and dashboard panels for BSRS Ch 8 P3 two-failure-domain rollout. This doc is the source of truth for what the operator builds in Better Stack and Sentry dashboards.
>
> Companion to [`docs/design-notes/bsrs-ch08-p3-design.md`](../design-notes/bsrs-ch08-p3-design.md) §6 (monitoring + rollback triggers) and [`docs/runbooks/expand-contract-migrations.md`](./expand-contract-migrations.md).

---

## 1. Why these rules exist

Post-P3b, 10% of production traffic is on canary and 90% on stable. Both channels run against the same Aurora writer, Redis, and Stripe account, so a bad canary does not break shared state — it breaks 10% of user requests. The alert rules below distinguish "canary is worse than stable" (roll canary back) from "both are degraded" (shared-infra incident, canary rollback won't help).

All five rules use the **multiplicative comparison** pattern rather than absolute counts. A 5xx rate of 1.0% is fine if stable is also at 1.0% (real-world baseline). A 5xx rate of 1.0% is a fire if stable is at 0.1% (canary-specific regression). Multiplicative thresholds normalize for the 10% traffic slice canary carries.

## 2. Required log + release tags (set by P3c code changes)

These tags already exist on every log line and error event after the P3c commit — the operator does not need to add them per-request:

| Signal | Source | Field |
|---|---|---|
| Every Better Stack log line | `lib/logger.ts` child logger | `deploy_channel: "canary" \| "stable"` and `commit_sha: <7-char SHA>` |
| Every Sentry error/transaction | `sentry.{server,edge,client}.config.ts` | `release: "bs@<channel>-<sha>"` |
| Every `/api/health` response | `app/api/health/route.ts` JSON body | `deploy_channel` + `commit_sha` fields |

If any of the rules below returns zero results, first verify the relevant tag is present on the source — the tag plumbing is the load-bearing prerequisite.

---

## 3. The five alert rules

Each rule has an **alert tier** (ticket the on-call inbox) and a **page tier** (page the on-call phone). Configure both thresholds in the same tool. Page tier is always stricter.

### Rule 1 — Canary 5xx rate divergence

| Field | Value |
|---|---|
| Tool | Better Stack (log alerts) |
| Source | BenefitsSafe application logs |
| Alert query | `deploy_channel:"canary" AND status:>=500` in a 5-minute rolling window, compared against `deploy_channel:"stable" AND status:>=500` in the same window |
| Alert threshold | canary 5xx rate **> 1.5×** stable 5xx rate for ≥ 5 minutes |
| Page threshold | canary 5xx rate **> 2×** stable 5xx rate for ≥ 5 minutes |
| On-call action | Open the comparison dashboard (§4). If the signal is stable-wide, go to the relevant shared-infra runbook. If canary-specific, follow [`failure-domain-failover.md`](./failure-domain-failover.md) to roll canary back. |

Noise control: exclude low-volume `deploy_channel:"canary" AND path_starts_with:"/api/platform/"` routes from the comparison — they have too few requests to give a meaningful rate.

### Rule 2 — Canary p95 latency divergence

| Field | Value |
|---|---|
| Tool | Better Stack (metrics alerts) |
| Source | Application logs with `duration_ms` field |
| Alert query | p95 of `duration_ms` where `deploy_channel:"canary"` vs p95 where `deploy_channel:"stable"`, 5-minute rolling window |
| Alert threshold | canary p95 **> 1.5×** stable p95 for ≥ 5 minutes |
| Page threshold | canary p95 **> 2×** stable p95 for ≥ 5 minutes |
| On-call action | Same as Rule 1 — open dashboard, identify channel-specific vs shared. |

Noise control: compute p95 only when the canary sample size ≥ 100 requests in the window. Otherwise fall back to p90 (single-sample p95 noise is too high).

### Rule 3 — Canary health probe

| Field | Value |
|---|---|
| Tool | Better Stack uptime monitors (one per channel) |
| Source | `GET https://canary.benefitssafe.com/api/health` and `GET https://stable.benefitssafe.com/api/health` — note: direct origin hostnames, bypassing the LB, so the probe measures each channel independently |
| Probe interval | 60s |
| Alert threshold | **1 canary failure** (single missed probe) |
| Page threshold | **3 consecutive canary failures** (~3 minutes) |
| On-call action | Read the failure body. If it says `"status": "down"` with a specific dependency marked, go to that dependency's runbook. If the canary probe fails but the stable probe is green, roll canary back. |

Verify the response body contains `"deploy_channel": "canary"` for the canary probe and `"deploy_channel": "stable"` for the stable probe — if either is wrong, the Vercel env-var wiring is broken (P3b regression).

### Rule 4 — Canary novel Sentry errors

| Field | Value |
|---|---|
| Tool | Sentry (issue alerts) |
| Source | All Sentry events |
| Alert query | `release:"bs@canary-*"` and `is:new` (first-seen issues) |
| Alert threshold | **Any novel error** on the canary release |
| Page threshold | **5 novel canary errors in 5 minutes** |
| On-call action | A single novel error on canary is usually a caught edge case worth investigating but not a rollback trigger. A cluster of 5+ novel errors in 5 minutes is a regression — roll canary back. |

Noise control: Sentry's built-in "new issue" detection already de-dupes by stack trace. If you see the same novel error counted 5 times, that is 5 distinct root causes, not 5 instances of one.

### Rule 5 — Canary Stripe circuit opens

| Field | Value |
|---|---|
| Tool | Better Stack (log alerts) |
| Source | BenefitsSafe application logs |
| Alert query | `deploy_channel:"canary" AND event:"stripe_circuit_open"` count in a 5-minute rolling window |
| Alert threshold | **> 2** in 5 minutes |
| Page threshold | **> 5** in 5 minutes |
| On-call action | A circuit open event signals the Stripe-facing canary code is either hammering Stripe with calls it shouldn't (regression) or Stripe is genuinely degraded (check the circuit state on stable too). If both channels are opening circuits, this is a Stripe-side incident — do not roll canary back. |

Noise control: the P1 Stripe circuit breaker is shared infrastructure. A genuine Stripe outage opens circuits on both channels simultaneously. Always cross-check stable before acting.

---

## 4. Comparison dashboard (Better Stack)

The operator builds one dashboard, titled "BenefitsSafe — canary vs stable", in Better Stack. Panels:

### Panel A — 5xx rate (lines)
Two series: `deploy_channel:"canary"` 5xx rate / min, and `deploy_channel:"stable"` 5xx rate / min. Y-axis log scale. Visual compare of Rule 1.

### Panel B — p95 latency (lines)
Two series: p95 `duration_ms` per channel, per-minute buckets. Visual compare of Rule 2.

### Panel C — Request volume (stacked area)
Confirms the ~10/90 traffic split is actually happening. If canary volume drops to zero, that's a traffic-routing bug — independent of whether canary is healthy.

### Panel D — Novel Sentry errors (bar)
Two series: count of `is:new` issues per release. Canary on the left, stable on the right, per 5-minute bucket. Makes Rule 4 visible at a glance.

### Panel E — Stripe circuit opens (bar)
Two series: `event:"stripe_circuit_open"` count per channel. Visual compare of Rule 5.

### Panel F — Deploy-channel health probe status (colored grid)
Two rows: canary probe, stable probe. Green / yellow / red cells per 60-second interval. Shows Rule 3 history for the past 24hr at a glance.

### Panel G — Rollout watermark
Single-value panel showing the current stable promotion SHA (read from the latest `deploy_promotion` event — added in P3d). Reminds the operator which commit is "baseline" vs "canary drift" during an incident.

---

## 5. Alert-routing defaults

Until the operator wires PagerDuty or similar, route all alerts to:

- **Alert tier** → email (dev@benefitssafe.com per `reference_betterstack.md` memory) + Slack `#alerts` channel (once provisioned).
- **Page tier** → phone / SMS via Better Stack incident-management integration. One primary on-call phone number; escalate to secondary after 10 minutes unacknowledged.

Every page must link to:
1. This runbook.
2. [`docs/runbooks/failure-domain-failover.md`](./failure-domain-failover.md) (P3e — the rollback procedure).
3. The comparison dashboard.

## 6. Signal-to-noise re-tuning

After one month of P3b traffic, re-tune thresholds. Expected over-firing scenarios and their remedies:

| Scenario | Remedy |
|---|---|
| Rule 1 fires on bursty low-volume endpoints | Lower the path-exclusion list; raise the sample-size floor. |
| Rule 2 fires during Stripe slowdowns (both channels affected equally) | Rule 5 should catch this — confirm circuit opens, ignore Rule 2 during correlated firings. |
| Rule 3 fires on Vercel cold starts | Raise probe timeout from 5s to 10s in Better Stack uptime config. |
| Rule 4 fires on every canary deploy | Expected — every new deploy has novel errors by construction for the first hour. Keep alert tier at "any", page tier at 5-in-5min, and accept the alert-tier noise as a release-monitoring signal. |
| Rule 5 fires during legitimate Stripe maintenance windows | Cross-check Stripe status page; silence during documented maintenance. |

Record every threshold tune in this file's git history — the diff is the audit trail for "why did we change the threshold from 1.5× to 1.7×."

## 7. Phase-2 considerations (P3f auto-rollback)

When P3f (auto-rollback cron, deferred in P3 design doc §10) lands, the **page tier** thresholds become the auto-rollback triggers. The alert tier stays as "human investigates"; only the stricter page tier triggers automated LB weight flip. Before that ships, a minimum of one quarter of manual-rollback experience must be accumulated — without that baseline, the auto-rollback thresholds are guesswork.

## 8. See also

- [`docs/design-notes/bsrs-ch08-p3-design.md`](../design-notes/bsrs-ch08-p3-design.md) — P3 design doc, §6 is the rationale for these thresholds.
- [`docs/runbooks/failure-domain-failover.md`](./failure-domain-failover.md) — P3e deliverable, the actual rollback procedure referenced by every page.
- Memory `reference_betterstack.md` — Better Stack account (dev@benefitssafe.com), source token, API lessons learned.

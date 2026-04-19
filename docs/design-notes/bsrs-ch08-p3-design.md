# BSRS Ch 8 P3 — Failure Domains via Vercel Aliased Deployments

> Phase 1 scoping design for BSRS Ch 8 P3. Approved by the operator at HEAD `d953f32` (post-P2c close). This document is the load-bearing rationale for the P3 sub-items. Implementation lands across P3a–P3e.
>
> Companion to [`docs/design-notes/bsrs-ch08-resilience-applied.md`](./bsrs-ch08-resilience-applied.md) §§3.4 + 4 (P3 paragraph) and [`docs/runbooks/expand-contract-migrations.md`](../runbooks/expand-contract-migrations.md).

---

## 1. Current state (pre-P3a)

**Vercel** — Single project `prj_yBSEiiDtXHeGoOIfayMxz6ryvYj7`. Minimal `vercel.json` (build env + 5 cron schedules). No alias, rollout, rewrite, or traffic-split configuration. Deploys are manual per `CLAUDE.md` (`git push` does NOT trigger — operator runs `vercel --prod`).

**CI** — `.github/workflows/ci.yml`: single job, runs `tsc`, `vitest`, `auth-guard-convention.mjs`, non-blocking `eslint`. No deploy step. After P3a, also runs `db-health-convention.mjs` and `stale-cache-convention.mjs` as blocking steps.

**Cloudflare** — `benefitssafe.com` DNS managed on Cloudflare (per `reference_cloudflare_dns.md` memory). Zero infrastructure-as-code in repo. Single origin (Vercel).

**Aurora / Prisma** — Single writer via `DATABASE_URL`. Optional `DATABASE_READ_URL` read-replica already wired in [`lib/db-read.ts`](../../lib/db-read.ts) with writer fallback. Pre-P3a: single application DB role. Post-P3a: three roles (`bs_migrator`, `bs_stable`, `bs_canary`) — see `scripts/db/create-aurora-roles.sql`.

**Shared state** (co-accessed by both channels once P3b lands): Aurora writer, Upstash Redis, S3, Stripe, QStash, Better Stack. Each requires either channel namespacing (Redis keys) or operator discipline (Stripe webhook URL → stable only).

**Git** — Only `main` branch exists at time of P3a design. `stable` branch is created at the end of the P3a commit.

## 2. P3 paragraph from resilience-applied doc (verbatim)

Lines 205-219 of `bsrs-ch08-resilience-applied.md`:

> ### P3 — Two failure domains via Vercel aliased deployments
>
> **Problem:** Zero failure domains (§3.4). Every deploy is all-or-nothing at 100% of traffic.
>
> **Approach:**
> 1. Use Vercel's aliased deployments: `main` branch deploys to `benefitssafe.com` (canary, 10% traffic); `stable` branch deploys to `stable.benefitssafe.com` (90% traffic via weighted DNS or Cloudflare load balancer).
> 2. Canary → stable promotion is a manual operation after canary burn-in period (24hr default; configurable shorter for hotfixes).
> 3. Each failure domain uses a separate Aurora database role (read-only vs full write) — not separate instances (single-region constraint stays for cost reasons), but separate logical access so a compromised canary role can't corrupt stable's data.
> 4. Document the failover runbook: "canary bad? Flip traffic to 100% stable, investigate without time pressure."
>
> **Expected effort:** 8-12 hrs (most of the time is DNS/load balancer setup + runbook + rehearsal).
>
> **BSRS section:** §"Failure Domains" — minimum viable two-domain setup.
>
> **Leverage:** Every future production incident caused by a bad deploy gets 10x smaller. Also unlocks A/B regression capability for free.

Two corrections applied in this design:

- The "read-only vs full-write" framing would make canary unable to serve any write — 10% of users 503ing on every expense approval is a broken deployment, not a failure domain. Replaced with **restricted-DML** (§5).
- "main → canary, stable → stable branch" is kept (train model), but the `main → canary` auto-deploy is enabled as part of P3b; stable promotions remain manual.

## 3. Architecture

```
                         Cloudflare (proxy)  benefitssafe.com
                         ┌──────────────────────────────┐
                         │   Load Balancer              │
                         │   weighted pool 10 / 90      │
                         │   cookie affinity enabled    │
                         │   /api/webhooks /jobs /cron  │
                         │   → carved out to stable     │
                         └──────┬────────────┬──────────┘
                             10%│         90%│
                                ▼            ▼
                     canary.benefitssafe     stable.benefitssafe
                     Vercel deployment A     Vercel deployment B
                     DEPLOY_CHANNEL=canary   DEPLOY_CHANNEL=stable
                            │                     │
        ┌───────────────────┼─────────────────────┼────────────────────┐
        │ shared state (single instance for cost)                      │
        │                                                              │
        │  Aurora writer  — bs_canary role          bs_stable role     │
        │                   bs_migrator role (CI / operator only)      │
        │  Upstash Redis  — keys prefixed by DEPLOY_CHANNEL (P3a)      │
        │  S3 / Stripe / QStash / Sentry / Better Stack — shared       │
        └──────────────────────────────────────────────────────────────┘
```

**Single Vercel project.** Both deployments come out of the same project. `vercel alias` is used to rebind which deployment each hostname points at. Two separate Vercel projects would split env vars + cron quotas + function concurrency budgets unnecessarily.

**What canary does NOT serve:**

- `/api/webhooks/**` — Stripe re-delivery semantics assume a single endpoint
- `/api/jobs/**` — QStash signing + idempotency
- `/api/cron/**` — Vercel cron binds to the "Production" deployment (which stays pointed at stable)
- `/api/events/**` — SSE event stream

These paths route 100% to stable via a Cloudflare LB host/path rule (§4).

## 4. Traffic splitting

**Chosen mechanism: Cloudflare Load Balancer (weighted pool).**

- Pool with two origins: `canary.benefitssafe.com` (weight 0.1) and `stable.benefitssafe.com` (weight 0.9).
- Apex `benefitssafe.com` proxied through the LB.
- Health check: `GET /api/health` on each origin, 5s interval, 2 consecutive failures removes origin.
- DNS TTL: `auto` (Cloudflare edge refresh ~30s).
- Cookie-based session affinity (`CF_LB_AFFINITY`) enabled — a user's session stays on one channel for its duration.

**Webhook / job / cron carve-out:** LB rule matches `/api/webhooks/*`, `/api/jobs/*`, `/api/cron/*`, `/api/events/*` and routes 100% to stable. Stripe webhook URL remains `https://benefitssafe.com/api/webhooks/stripe`; the LB sees the path rule before weighing origins.

**Cost:** ~$10-15/mo (Cloudflare LB base $5 + $0.50/origin × 2 + health monitors + DNS queries). Approved by operator. Alternative (Vercel Rolling Deployments) deferred — stays as fallback if Cloudflare LB proves constraining.

**Without session stickiness** a user's requests roll independent weighted dice; the same page load could hit canary for `/api/grants` and stable for `/api/dashboard`, causing data-shape inconsistencies during expand-phase migrations. Stickiness is non-optional.

## 5. Aurora role separation

**Rejected:** "read-only canary" from the original paragraph. 10% of users cannot perform any write is a broken deployment.

**Adopted:** three logical roles on the same cluster.

| Role | Grants | Held by |
|---|---|---|
| `bs_migrator` | DDL + full DML (GRANT ALL) | CI migration job or operator shell — never a Lambda |
| `bs_stable` | DML on all tables; **no UPDATE/DELETE** on `LedgerEntry`, `AuditLog`, `ProcessedWebhookEvent`; no DDL | Stable deployment at runtime |
| `bs_canary` | Same as `bs_stable`, plus a `BEFORE INSERT OR UPDATE` trigger on `OrganizationMembership` that blocks privilege-escalation roles (`platform_admin`, `compliance_officer`, `billing_admin`, `support_agent`) | Canary deployment at runtime |

SQL lives in [`scripts/db/create-aurora-roles.sql`](../../scripts/db/create-aurora-roles.sql) — idempotent, operator-run, passwords substituted from AWS Secrets Manager.

**What this protects against:**

- DDL from a compromised Lambda (DDL revoked from both runtime roles — only `bs_migrator` has it, and that role is not on any Lambda).
- Canary minting new platform-admin memberships (trigger-enforced).
- Mutation/deletion of the immutable ledger (UPDATE/DELETE revoked on those three tables for both runtime roles — was convention, is now DB-level).

**What this does not protect against:** buggy application code writing garbage values via legitimate DML (e.g., `UPDATE Grant SET remainingAmount = 0`). That failure mode is controlled by traffic weighting (only 10% of users hit the bug) + fast rollback (<60s weight flip), not DB permissions.

**Scope notes:**

- `User.role` is also a privilege-bearing column but is not guarded by the P3a trigger — logging a separate canary-level guard on `User.role` is tracked as **OQ-9** and deferred to P3b.
- The expand-contract migration discipline (§6 of `docs/runbooks/expand-contract-migrations.md`) is the companion control that makes the `bs_migrator` role's DDL workflow safe when canary + stable are both live.

## 6. Monitoring + rollback triggers

**Tagging:** Sentry release `bs@<channel>-<sha>`; Better Stack log tag `deploy_channel: "canary" | "stable"`. Both tags derive from `DEPLOY_CHANNEL` env var (set in Vercel per-deployment; defaults to `"stable"` if unset, so local dev and preview deployments produce a deterministic tag).

**Comparison metrics, 5-minute rolling window, canary vs stable:**

| Signal | Auto-alert threshold | Auto-rollback threshold |
|---|---|---|
| HTTP 5xx rate | canary > 1.5× stable | canary > 2× stable for 5 min |
| p95 latency | canary > 1.5× stable | canary > 2× stable for 5 min |
| `/api/health` failures | any | 3 consecutive failures |
| Uncaught Sentry errors | novel-error rate > 0 | novel errors × 5 in 5 min |
| P1 Stripe-circuit opens | canary > 2 in 5 min | canary > 5 in 5 min |

**Phase 1 recommendation:** alerts only + manual rollback. Auto-rollback (P3f) is deferred until we have a quarter of signal-to-noise data.

**Manual rollback:** operator runs a documented `curl` against the Cloudflare LB API that sets canary weight to 0. Effective in ~30s (edge refresh). RTO target: <2 min from alert fire to 100% stable traffic.

**Noise floor (FM-5):** the multiplicative threshold (1.5× / 2×) rather than absolute counts normalizes for canary's 10% sample size. Platform-admin routes (low-volume, noisy) are excluded from the comparison.

## 7. Promotion process

Promotion from canary to stable requires **all** of:

1. Canary has been live for ≥24 hours continuously (wall clock).
2. canary error rate ≤ stable × 1.2 across the window.
3. canary p95 latency ≤ stable × 1.2 across the window.
4. No auto-alerts fired in the 24hr window.
5. No manual rollback triggered in the 24hr window.
6. A human operator explicitly runs the promotion — never automatic.

**Implementation (P3d deliverable):** GitHub Action `promote-canary-to-stable.yml`, `workflow_dispatch` trigger. Inputs: `canary_sha`, optional `override_burn_in_reason`. Steps: query Better Stack for the 24hr window, assert thresholds, fast-forward `stable` branch, trigger Vercel production deploy, rebind `stable.benefitssafe.com` alias, emit `deploy_promotion` event.

**Branch protection on `stable`:** only the GitHub Action's bot identity can push. Humans cannot push directly. Configured via GitHub UI.

**Hotfix override:** skips the 24hr check if `override_burn_in_reason` is provided; reason is captured in the promotion event for audit.

## 8. Failover runbook (P3e deliverable)

Location: `docs/runbooks/failure-domain-failover.md`. Five-section checklist:

1. **Detect** — alert fires in Sentry / Better Stack / PagerDuty. Confirm channel via `deploy_channel` filter.
2. **Decide** — canary-only (rollback canary) or shared-infra (Aurora / Stripe / Redis — go to that dependency's runbook; rollback won't help).
3. **Rollback canary** — documented `curl` against Cloudflare LB API, canary weight → 0. Verify via `GET /api/health`.
4. **Investigate** — canary deployment still exists in Vercel, accessible at `canary.benefitssafe.com` for out-of-traffic debugging.
5. **Re-canary** — fix-forward with a new `main` commit or revert. Restart the 24hr burn-in.

First real exercise of the runbook happens during the quarterly P5 game day (§9).

## 9. Interaction with P2 and P5

**P2 (degraded mode):**

- Both channels run identical `getDbHealth()` pollers against the same Aurora writer — `db_status` is coherent across channels.
- **Redis stale-cache keys are namespaced by channel** starting in P3a: `STALE_CACHE_KEY_PREFIX` becomes `` `cache:degraded:${DEPLOY_CHANNEL || "stable"}` ``. Without this, a buggy canary populates stale-cache entries that a stable request then serves — cross-channel pollution. Defaults to `"stable"` when `DEPLOY_CHANNEL` is unset (local dev, single-deployment environments).
- P2b's `assertDbHealthy()` write-gate is channel-neutral — no change.
- Rate-limit counters and other non-stale-cache Redis keys (`audit-cooldown:*`, `CACHE_KEYS.*`) still share a namespace; a second cross-channel namespacing pass is tracked as a P3b follow-up.

**P5 (game days):**

- The quarterly game day uses the failover runbook as its scenario — "canary serving bad data, operator detects + rolls back + postmortems." 2-hour time-box, one operator runs the runbook while another injects the fault.
- P5 chaos scripts (`scripts/chaos/*`) can target canary-only via a `DEPLOY_CHANNEL`-aware feature flag: `scripts/chaos/inject-canary-500.mjs` causes 10% of users to see synthetic 500s, exercising the auto-alert + rollback pipeline without a real bug.
- P5 load tests run against canary first — baseline comparison is live because 10% of production is always canary, so p95 regression detection becomes a live signal instead of a staging-only check.

## 10. P3 sub-item inventory

| ID | Scope | Effort | Blocks |
|---|---|---|---|
| **P3a** | Infrastructure foundations. `stable` branch + protection docs. Aurora role SQL script + verification queries. `DEPLOY_CHANNEL` env var + stale-cache key channel prefix. Expand-contract migration runbook. P2b/P2c linters wired into CI. This doc. | 3-4 hrs | P3b |
| **P3b** | Traffic splitting. Cloudflare LB pool + origins + health monitors. `canary.benefitssafe.com` + `stable.benefitssafe.com` DNS + Vercel aliases. 10/90 weights + cookie affinity + webhook/job/cron carve-out. Session-stickiness end-to-end verification. Set `DEPLOY_CHANNEL` env var on each Vercel deployment. | 3-4 hrs | P3c, P3d |
| **P3c** | Observability + alert rules. Sentry release tagging per channel. Better Stack `deploy_channel` filter. Comparison dashboard. Five alert rules wired to paging. | 2-3 hrs | P3e |
| **P3d** | Promotion workflow. `promote-canary-to-stable.yml` GitHub Action with 24hr gate + hotfix override. `stable` branch protected so only the bot pushes. `deploy_promotion` event stream. | 2-3 hrs | P3e |
| **P3e** | Failover runbook + first rehearsal. `docs/runbooks/failure-domain-failover.md`. No-op rehearsal in staging. First real game day under P5. | 1-2 hrs | — |
| **P3f** *(optional, deferred)* | Auto-rollback cron. Scheduled comparator that flips LB weights when thresholds are crossed. | 3-4 hrs | — |

Mandatory P3a-P3e total: **11-16 hrs**. P3f stays optional until one quarter of manual-rollback experience is accumulated.

## 11. Assumptions + new infrastructure

**Assumptions — operator to correct if any are wrong:**

- **A-1** Vercel plan supports multiple aliased deployments with independent env vars (Pro minimum).
- **A-2** Vercel Rolling Deployments is either available on our plan (would be a cheaper alternative to Cloudflare LB) or we accept the LB cost.
- **A-3** Cloudflare zone is on a plan that exposes the Load Balancer add-on.
- **A-4** Stripe webhook URL can be updated to remain on apex `/api/webhooks/stripe`, with the LB path-routing it to stable.
- **A-5** Vercel cron binds to the project's "Production" deployment, which stays pointed at stable.
- **A-6** Aurora cluster allows creating new login roles (RDS default; non-default IAM-auth schemes would need the SQL rewritten).
- **A-7** `CF_LB_AFFINITY` cookie does not conflict with NextAuth's session cookie on `.benefitssafe.com`.
- **A-8** Better Stack accepts the `deploy_channel` structured tag for filtering + alert rules.

**New infrastructure (operator approved):**

- **N-1** Cloudflare Load Balancer add-on: ~$10-15/mo ongoing.
- **N-2** Three new Aurora DB login roles + three AWS Secrets Manager entries.
- **N-3** `stable` GitHub branch + branch protection (free; admin PAT for bot-push permission in P3d).
- **N-4** `canary.benefitssafe.com` + `stable.benefitssafe.com` DNS records on Cloudflare (free).

No other new services. Everything else reuses capabilities already in the stack.

## 12. Open questions (as of P3a close)

Resolved during design review:

- **OQ-1** Aurora role model → restricted-DML (§5). ✅
- **OQ-2** Git semantics → `main → canary` auto, `stable → stable` manual. ✅
- **OQ-3** Traffic-split mechanism → Cloudflare LB (§4). ✅
- **OQ-4** 24hr burn-in → fixed at 24hr; hotfix override via promotion workflow input. ✅
- **OQ-5** Auto-rollback → deferred to P3f. ✅
- **OQ-6** Webhook carve-out → yes, bypass LB → 100% stable. ✅
- **OQ-7** P2b/P2c linters → wired into CI as part of P3a. ✅
- **OQ-8** Write this design doc to `docs/design-notes/` → yes (this file). ✅

Deferred to P3b and beyond:

- **OQ-9** Guard `User.role` column with a canary-level trigger. P3a guards only `OrganizationMembership.role`. Re-evaluate in P3b.
- **OQ-10** Second-pass Redis namespacing for rate-limit counters, `CACHE_KEYS.*` perf cache, `audit-cooldown:*`. Cross-channel pollution risk is lower than stale-cache pollution but nonzero. Targeted for P3b.

---

*End of P3 Phase 1 design doc. Implementation landing across P3a–P3e per the inventory in §10.*

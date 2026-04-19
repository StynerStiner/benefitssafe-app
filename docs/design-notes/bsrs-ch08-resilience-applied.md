# BSRS Ch 8 — Design for Resilience, applied to BenefitsSafe

> Applied reading of *Building Secure and Reliable Systems*, Chapter 8 (Shipitsyn, Adler, Egyed, Blankinship et al.) against the current state of the BenefitsSafe platform, producing a P-inventory of resilience gaps ordered by leverage × fix-cost.
>
> Companion to [`docs/design-notes/bsrs-ch05-least-privilege-applied.md`](./bsrs-ch05-least-privilege-applied.md) and [`docs/design-notes/ddia-ch07-transactions-applied.md`](./ddia-ch07-transactions-applied.md).
>
> Produced at baseline commit `a93cba4` (post-P4-fully-closed).

---

## 1. Chapter summary

Chapter 8 argues that *resilience* — a system's ability to withstand a major malfunction or disruption and return to normal operations without manual intervention — is a distinct design quality from *recovery* (Ch 9). Recovery is about fixing broken systems; resilience is about delaying or absorbing breakage so recovery has time to happen. Resilience properties are built on the other design qualities in Part II of the book (least privilege, understandability, adaptability), and in turn support them.

The chapter's core design principles are:

1. **Defense in depth** — each layer independently resilient; each layer anticipates the failure mode of the previous one. Illustrated by the Trojan Horse (a one-layer defense fails catastrophically) and Google App Engine's Python sandboxing (API allowlist + NaCL bitcode + ptrace syscall filter — three independent layers, each catching what the previous missed).
2. **Controlled degradation** — when load exceeds capacity, choose which functions to disable instead of letting the system crash unpredictably. Load shedding (return errors for excess requests at the server edge) + throttling (delay responses to back-pressure clients) are the two primitives. Automation decides "when" based on server utilization; humans stay in the loop for policy and unforeseen circumstances.
3. **Blast radius controls** — compartmentalize the system so a compromise or failure in one compartment doesn't propagate. Role separation (different service accounts for different data classes), location separation (per-region credentials and keys), time separation (key/credential rotation).
4. **Failure domains + redundancy** — partition the system into independent equivalent copies (failure domains), with component redundancy across three tiers: high-capacity (normal fleet), high-availability (fewer deps, slower change rate, lower outage probability), low-dependency (minimal features, minimal deps, used only when everything else is broken).
5. **Continuous validation** — exercise all of the above regularly so they stay effective. Inject load/latency/failures; mirror traffic to high-availability components; split traffic across failure domains; measure key rotation end-to-end.

The chapter's explicit recommendation for smaller organizations: start with controlled degradation, blast radius controls, and failure domains. Continuous validation and low-dependency components come later as the organization grows.

The chapter's security-reliability tradeoff framing is worth naming: security-critical operations should **never** fail open. An outage under attack is preferable to letting the attacker degrade security via DoS alone (a bank with 2FA down should refuse logins, not let users in without 2FA). But this tradeoff must be explicit per-service — a chat app failing open (read-only mode when backend is down) is fine; an ACL service failing open is a catastrophe.

---

## 2. Where BenefitsSafe is today

BenefitsSafe is a solo-founder fintech compliance platform designed for 1.9M+ nonprofits (floor) scaling. Current architecture, ordered by layer:

### 2.1 Defense-in-depth layers (what exists)

| Layer | Mechanism | Status |
|---|---|---|
| L1 — Edge | Cloudflare (WAF, rate limiting, DDoS mitigation) | In place |
| L2 — Runtime | Next.js 15 App Router on Vercel (HTTPS, CSP, HSTS via middleware) | In place |
| L3 — Session auth | NextAuth v5 JWT, session fingerprinting, MFA, 1hr idle timeout | In place (hardened pre-launch) |
| L4 — Route auth | Shared guard helper (P4.2 commit `95b7904`) + convention linter (P4.3 commit `059b9aa`) | In place |
| L5 — Query auth | Prisma org-scoping extension in shadow mode (Phase 1) | Live but not enforced |
| L6 — DB | Aurora PostgreSQL, RLS not enabled, deletion protection on | Partial |
| L7 — Audit | AuditLog table (append-only by convention, not by constraint) | Partial |
| L8 — Webhook auth | Stripe signature verification; idempotency via ProcessedWebhookEvent (Ch 7 P2) | In place |
| L9 — Job auth | QStash `verifyJobAuth()` bearer tokens | In place |
| L10 — AWS | CloudTrail + KMS + S3 lockdown + Secrets Manager | In place |

Ten layers exist. Not all are independently resilient — several share fate (e.g., a Vercel platform incident takes out L2, L4, L5, L9 simultaneously; Aurora unavailability takes out L5, L6, L7 in one shot).

### 2.2 Controlled degradation (what exists)

- **Load shedding at the edge:** Cloudflare rate limits. No application-layer shedding.
- **Throttling:** Per-IP rate limits on login, MFA verify, password reset. No per-tenant or per-user throttling on write endpoints.
- **Graceful feature disable:** Feature flags exist for SentinelLayer agents (`sentinelWatchdog`, `sentinelCompliance`, `sentinelReporter`). No general-purpose feature-flag kill-switch for non-critical routes.
- **Cascading-failure protection:** None explicit. A slow Stripe API call blocks the request thread; no circuit breaker.
- **Lame-duck mode for servers:** N/A — Vercel serverless, no long-lived server instances.

### 2.3 Blast radius controls (what exists)

- **Role separation:** Service accounts are partial — Stripe uses one set of keys for all merchants (not per-org); AWS uses one IAM role for all Vercel functions; database uses one Prisma connection pool. No microservice-level role separation because the architecture is a monolith.
- **Org-level separation:** Every write is org-scoped at the query layer (P4.2) + shadow-validated at the middleware layer (Prisma extension Phase 1). This is the *primary* blast radius control and is well-developed.
- **Location separation:** Single Aurora cluster in `us-east-2`. Single S3 bucket (multi-region replication not yet enabled). Vercel functions are multi-region but share the same AWS credentials.
- **Time separation:** Session JWTs rotate every 15 min (updateAge), expire at 1hr. AWS access keys: manual rotation (runbook exists but not executed on a schedule). Stripe API keys: never rotated since launch. Database password: rotated once; no schedule.

### 2.4 Failure domains (what exists)

- **Failure domain count: 1.** There is no partition of the production environment into independent failure domains. A bad deploy, a bad migration, a bad config change propagates to 100% of traffic simultaneously.
- **Canary:** None. Vercel's preview-deployment feature is per-branch, not used for production traffic percentages.
- **A/B regression capability:** None at the production level.
- **Geographic separation:** Aurora single-region. Vercel auto-distributes functions but state (DB + S3) is single-region.
- **Data isolation:** Single Aurora instance, no standby or read-replica promotion rehearsed. Daily backup runs; restore is manual and untested.

### 2.5 Component tiers (what exists)

- **High-capacity:** The main Vercel deployment. This is the only tier.
- **High-availability:** None. No "fewer dependencies, older code, slower changes" fallback.
- **Low-dependency:** None. If Aurora is down, there is no alternative path for any user-facing feature.

### 2.6 Continuous validation (what exists)

- **Unit + integration tests:** 164 tests passing (vitest), covering org-scoping classifier, auth-guard, error-response, schema validation, webhook idempotency. No end-to-end tests.
- **Convention linter:** `scripts/lint/auth-guard-convention.mjs` (P4.3 commit `059b9aa`) blocks three regression classes in CI.
- **Load testing:** None. No Artillery/k6/autocannon suite exists.
- **Chaos testing:** None.
- **Failure injection:** None.
- **Game days / disaster readiness exercises:** None.
- **Key rotation measurement:** None (no runbook measures end-to-end latency of an AWS key rotation or Stripe key rotation).

---

## 3. Gap analysis — BSRS Ch 8 concepts mapped to BenefitsSafe

### 3.1 Defense in depth — how layers interact on failure

Ten layers listed in §2.1, but the chapter's deeper question is: *when layer N fails, what does layer N+1 do?*

Current behavior:

| Scenario | Expected layer catch | Actual behavior |
|---|---|---|
| Attacker bypasses Cloudflare WAF | L4 (route auth) rejects | ✓ — guard denies request |
| Attacker forges session JWT | L3 detects bad signature | ✓ — NextAuth rejects |
| Route auth misses (bug in new route) | L5 (Prisma middleware) catches wrong-org query | ⚠ — middleware is in shadow mode, logs but doesn't block |
| SQL injection via Prisma | L6 (RLS) rejects query | ✗ — RLS not enabled, relies on Prisma's parameterized queries |
| Insider reads other org's data via DB console | L6 (RLS) or L7 (audit) catches | ⚠ — AuditLog captures the query only if it goes through the application; direct DB access is undetected |
| Vercel platform compromise | L10 (AWS) isolates | ⚠ — Vercel has broad AWS permissions; a Vercel breach gets meaningful AWS blast radius |

Four of six scenarios have a gap or a shadow-mode defense. The most concerning is the direct-DB-access insider scenario — no L6 or L7 defense exists for an attacker who gains database credentials from AWS Secrets Manager.

### 3.2 Controlled degradation — what breaks first?

If Aurora goes slow (not down — just slow, connection pool saturated):

- Every request blocks on `prisma.*.findMany()` until timeout (default 10s for Vercel Edge functions, 60s for Node functions).
- Client-visible behavior: spinner → 504 Gateway Timeout from Vercel.
- No graceful degradation. No stale-cache fallback. No "we're degraded, read-only mode" banner.

If Stripe API goes slow:

- `virtual-cards/[id]/close` waits for Stripe response, times out, returns 500.
- No circuit breaker — 100 concurrent users clicking "close card" during a Stripe incident all wait the full timeout, exhausting the Vercel function concurrency budget.
- Cascading failure: Stripe slowness → function concurrency exhaustion → unrelated requests (grants list, notifications) start failing.

If SentinelLayer agents fall behind:

- No user-visible impact (agents are background workers). ✓ — already compartmentalized.

The pattern: *background / async paths have good compartmentalization; synchronous user paths have none.*

### 3.3 Blast radius — cross-org

BenefitsSafe is built around **org-scoping as the primary blast radius control.** The P4 work (guard + linter + Prisma middleware Phase 1) has made this the strongest part of the system. When Phase 2+3 of the Prisma middleware ships (block-mode enforcement at the query layer), cross-org leakage becomes impossible even from a buggy new route.

But blast radius has dimensions beyond org:

- **Role blast radius:** A compromised `platform_admin` session has all-org access. The admin account has no time-limited grants, no approval workflow for cross-org operations. BSRS Ch 5 P3 (expiring role grants) is the canonical fix and is open.
- **Geographic blast radius:** Single region. A `us-east-2` AWS incident takes down 100% of writes until Aurora recovers. RPO is whatever the most recent backup captured (daily); RTO is untested.
- **Time blast radius:** Keys don't rotate on a schedule. A Stripe API key leak from two years ago is still valid today.

### 3.4 Failure domains — none

This is the largest gap. Every production deploy is a single-shot operation affecting 100% of users. A bad migration (even guarded by Ch 7's transactional safety) causes a full platform outage. Rollback is a manual Vercel operation that takes 3-5 minutes.

The chapter's minimum recommendation is *two* failure domains — A/B canary capability, limit the blast radius of changes. BenefitsSafe has zero.

### 3.5 Low-dependency / high-availability components — none

If Aurora is down, every user-facing feature breaks. There is no read-only cache layer, no S3-backed export fallback, no static "maintenance mode" page that tells users "we're down, here's the ETA." Users see raw Vercel 500s.

### 3.6 Continuous validation — minimal

The P4.3 convention linter is the strongest piece of continuous validation currently in place. Vitest covers unit and integration logic. Neither validates:

- Behavior under load
- Behavior during failure (Aurora slow, Stripe down, S3 unavailable)
- End-to-end user workflows
- Cross-region failover
- Key rotation latency
- Audit log completeness after an incident

---

## 4. P-inventory

Ordered by leverage × fix-cost. Solo-founder scope. Numbering continues the BSRS Ch 8 namespace (distinct from Ch 5's P1-P5).

### P1 — Circuit breaker + timeout budget for Stripe calls

**Problem:** A slow Stripe API causes cascading failures via Vercel function concurrency exhaustion (§3.2). Currently every Stripe call has an implicit full-function timeout.

**Approach:**
1. Add `lib/stripe-circuit.ts` — wraps Stripe SDK calls with:
   - Per-call timeout (3s default for read, 10s for write)
   - Rolling error-rate window (if 50%+ of last 20 calls errored, open circuit for 30s)
   - Fallback behavior: return structured `CircuitOpenError` that routes convert to 503 with `Retry-After`
2. Retrofit the five Stripe-dependent routes: `virtual-cards/[id]/close`, `virtual-cards/[id]/pause`, `grants/[id]/issue-card`, `expenses/[id]/issue-card`, `billing/checkout`.
3. Emit circuit-state events to structured logs (Better Stack) so operator can see circuit open/close transitions.

**Expected effort:** 4-6 hrs.

**BSRS section:** §"Controlling Degradation" — load shedding at the client-of-dependency layer.

**Leverage:** Prevents the highest-probability cascading failure mode (third-party API slowness). Stripe has had multi-minute slowdowns twice in 2025 per their status page; next incident is when, not if.

**Shipped (P1a + P1b):** P1a `4fc087a` (core module + tests), P1b `399c4e0` (Tier 1 user-facing, 10 sites) + `37cc4ba` (Tier 2 org-onboarding + card-issuance, 25 sites) + `10ebd00` (Tier 3 cron routes, 6 sites). 41 outbound Stripe call sites wrapped across 18 files. 27 Pattern β re-throws. Circuit breaker infrastructure is now load-bearing for every outbound Stripe call in the platform.

### P2 — Aurora read-only degraded mode + maintenance page

**Problem:** When Aurora writes are unavailable (primary failover, migration stuck, etc.), every user-facing action returns 500. No graceful degradation (§3.2, §3.5).

**Approach:**
1. Add `lib/db-health.ts` — periodic health check (every 30s) tracked in-memory per function instance; emits `db_status: "healthy" | "degraded" | "down"`.
2. Add middleware that short-circuits write routes when `db_status === "down"`: return 503 with structured body `{ error: "Service temporarily unavailable", correlationId, kind: "dependency_unavailable" }`.
3. Add `app/api/health/deep/route.ts` — comprehensive dependency check (Aurora read, Aurora write, Stripe, S3) returning JSON with per-dependency status. Consumed by a static "maintenance mode" banner component on all pages.
4. Banner component shows user-friendly message when any dependency is degraded. Reads go through cached data with staleness timestamp; writes are disabled with UI-level gate.

**Expected effort:** 6-8 hrs.

**BSRS section:** §"Controlling Degradation" — controlled degradation, UX adaptation.

**Leverage:** Turns "our platform is broken" support tickets into "we're in a known degraded state, ETA follows" — massive operator workload reduction during incidents.

**Shipped (P2a):** commit `f9e4c43` — `lib/db-health.ts` + 12 tests + `DegradedBanner` + `/api/health` cache extension + 5 canonical route retrofits (`grants/POST`, `grants/[id]/issue-card/POST`, `beneficiaries/[id]/PATCH`, `platform/expiring-grants/POST`, `org/fund/POST`). P2b retrofits the remaining 63 write routes in tiers (test-mock propagation tax: every test file that `vi.mock`s `@/lib/db` also needs a `vi.mock` for `@/lib/db-health`). P2c (stale-cache reads serving data with a staleness timestamp when Aurora is down) is deferred further.

### P3 — Two failure domains via Vercel aliased deployments

**Problem:** Zero failure domains (§3.4). Every deploy is all-or-nothing at 100% of traffic.

**Approach:**
1. Use Vercel's aliased deployments: `main` branch deploys to `benefitssafe.com` (canary, 10% traffic); `stable` branch deploys to `stable.benefitssafe.com` (90% traffic via weighted DNS or Cloudflare load balancer).
2. Canary → stable promotion is a manual operation after canary burn-in period (24hr default; configurable shorter for hotfixes).
3. Each failure domain uses a separate Aurora database role (read-only vs full write) — not separate instances (single-region constraint stays for cost reasons), but separate logical access so a compromised canary role can't corrupt stable's data.
4. Document the failover runbook: "canary bad? Flip traffic to 100% stable, investigate without time pressure."

**Expected effort:** 8-12 hrs (most of the time is DNS/load balancer setup + runbook + rehearsal).

**BSRS section:** §"Failure Domains" — minimum viable two-domain setup.

**Leverage:** Every future production incident caused by a bad deploy gets 10x smaller. Also unlocks A/B regression capability for free.

### P4 — Key rotation schedule + measurement

**Problem:** AWS access keys, Stripe API keys, database credentials don't rotate on a schedule (§3.3 — time separation gap). No measurement of how long rotation takes if we had to do it in an emergency.

**Approach:**
1. Schedule quarterly rotations:
   - AWS IAM keys (via `docs/runbooks/aurora-credential-rotation.md` — already exists, just needs a calendar entry + measured execution)
   - Stripe API keys (test + live)
   - Database password
2. Each rotation emits a structured log event: `{ event: "credential_rotation", credential: "...", started_at, completed_at, latency_ms }`.
3. Track the latency in a `docs/runbooks/credential-rotation-history.md` ledger — so when an emergency rotation is needed, we have realistic expectations.
4. Add a linter check (scripts/lint/credential-freshness.mjs) that warns if any credential in the rotation ledger is older than 100 days.

**Expected effort:** 3-4 hrs first rotation (slower due to exercising cold runbook), 30min subsequent rotations.

**BSRS section:** §"Time Separation" + §"Measure Key Rotation Cycles."

**Leverage:** Makes emergency rotation (post-breach scenario) a known-quantity operation instead of an improvised scramble. The first rotation under routine conditions will surface at least one broken assumption; better to discover that now than during an actual incident.

**Shipped:** commit `bbb9378` — ledger + logger + linter + index runbook. First real rotation pending as an operational task.

### P5 — Load testing + failure injection (continuous validation tier)

**Problem:** No load validation, no failure injection, no game days (§3.6).

**Approach:**
1. Add `scripts/loadtest/` directory with k6 or autocannon scripts covering the top-5 endpoints by expected production traffic (grants list, beneficiary list, dashboard, notifications, login).
2. Establish baseline metrics: p50/p95/p99 latency, error rate, req/s throughput at 1x, 5x, 20x expected load.
3. Run monthly in staging. Document baselines in `docs/runbooks/load-baselines.md`; alert if a deploy regresses p99 by 30%+.
4. Add failure-injection scripts: `scripts/chaos/aurora-slow.mjs` (introduces 200ms latency on every query via Prisma middleware), `scripts/chaos/stripe-down.mjs` (returns CircuitOpenError from all Stripe calls). Run manually during game days.
5. Quarterly game day: one scenario, 2-hour time-box, one operator exercises incident response while another injects faults.

**Expected effort:** 12-20 hrs initial (load scripts + baselines + chaos scripts). Recurring: 1hr/month load run, 2hrs/quarter game day.

**BSRS section:** §"Continuous Validation" — inject anticipated changes, exercise emergency components as part of normal workflows.

**Leverage:** This is the multiplier on every other resilience investment. Without validation, P1-P4 drift into non-functional decoration over months. With validation, every incident surfaces a fixable gap.

### P6 — Deferred (future work)

- **Low-dependency service tier** — a read-only cache-served fallback when Aurora is completely unavailable. Substantial engineering cost; BSRS explicitly recommends deferring until after P1-P5 are in place.
- **Multi-region Aurora** — eliminates single-region blast radius. Cost is meaningful ($500+/mo minimum) and the complexity is high. Deferred until revenue justifies.
- **Threat intelligence + dedicated monitoring team** — BSRS recommends against this for smaller orgs. Revisit when Anthropic-scale.

---

## 5. Scorecard

| P | Item | Effort | BSRS section | Status |
|---|---|---|---|---|
| P1 | Stripe circuit breaker + timeout budget | 4-6 hrs | Controlling Degradation | P1a CLOSED in `4fc087a`; P1b CLOSED across `399c4e0`+`37cc4ba`+`10ebd00` |
| P2 | Aurora degraded-mode + maintenance page | 6-8 hrs | Controlling Degradation | P2a CLOSED in `f9e4c43`; P2b CLOSED across `8c8df95`+`bef76ec`+`cdf1218`+`8aaf366`+`13534e7`; P2c open |
| P3 | Two failure domains (Vercel aliased deploys) | 8-12 hrs | Failure Domains | Open |
| P4 | Quarterly key rotation + latency measurement | 3-4 hrs first, 30min recurring | Time Separation + Key Rotation Cycles | CLOSED in `bbb9378` |
| P5 | Load testing + failure injection + quarterly game day | 12-20 hrs initial, recurring | Continuous Validation | Open |
| P6 | Low-dep tier, multi-region, threat intel team | Multi-session / deferred | §Where to Begin | Deferred |

---

## 6. Recommended sequencing

The chapter's explicit advice is: *failure domains and blast radius controls first (relatively static, significant improvement); high-availability services next; load shedding/throttling next; continuous validation to lock everything in.*

Mapped to BenefitsSafe's P-inventory, that sequence is:

1. **P4 first** (key rotation + measurement). 3-4 hrs. Lowest effort, highest "discover broken assumptions in low-stakes conditions" value. Surfaces whatever is silently broken before we build resilience on top of it.
2. **P1 next** (Stripe circuit breaker). 4-6 hrs. Addresses the highest-probability cascading-failure mode. Composable with P2.
3. **P2** (degraded mode). 6-8 hrs. Pairs naturally with P1 — both are about how the system behaves when a dependency is slow or unavailable.
4. **P3** (failure domains). 8-12 hrs. The biggest single resilience multiplier, but also the biggest infrastructure surgery. Do it after P1+P2 so the failure-domain rollout has graceful degradation already in place.
5. **P5** (continuous validation). 12-20 hrs. Do last — it validates everything above. Going earlier wastes cycles validating things that are about to change.

Total P1-P5: ~33-50 hrs across 5 PDRs. No single PDR is larger than 20 hrs.

---

## 7. Cross-chapter ties

- **Ch 5 (Least Privilege):** P4.3's convention linter (commit `059b9aa`) is continuous validation applied to least-privilege patterns. This chapter's P5 extends that discipline to resilience patterns.
- **Ch 7 (Transactions, DDIA):** The Serializable tx retry wraps (commits `70808ee`, `dea1876`, `dab2f0f`) are defense in depth at the database layer — when serialization fails, the retry loop catches it. Ch 8's framing makes explicit what Ch 7's work implicitly achieved.
- **Ch 9 (Recovery):** BSRS Ch 9 (already summarized as a styled PDF in prior work) covers what happens *after* resilience runs out. P4 (key rotation) and P5 (game days) are the bridge between the two — the mechanisms that keep recovery drills realistic.

---

## 8. Open questions

1. Does Cloudflare's existing rate limiting + WAF constitute "load shedding" in the BSRS sense, or do we need application-layer shedding? The chapter's framing is that edge shedding is one layer; application-layer shedding (knowing per-request cost and priority) is another. BenefitsSafe has the first but not the second.
2. For P3 (failure domains), is the two-domain model via Vercel aliased deployments sufficient, or do we need a fully separate AWS account for the stable domain to get real infrastructure isolation? The chapter's example (Google's per-location root of trust) argues for deeper isolation, but the cost at our scale likely doesn't justify separate AWS accounts.
3. The "fail safe vs fail secure" tradeoff (§"Automate Responsibly") — BenefitsSafe deals with SSI/Medi-Cal/CalFresh beneficiary data. When in doubt, we should fail secure (deny access rather than risk exposure). P2 (Aurora degraded mode) must not degrade to "allow all reads without auth check" under any failure condition. This should be an explicit invariant in P2's PDR.

---

*End of Ch 8 applied doc. Scorecard mirrors Ch 5's format for cross-doc consistency.*

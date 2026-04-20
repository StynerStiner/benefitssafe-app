# DDIA Chapter 8 (The Trouble with Distributed Systems) Applied to BenefitsSafe

**Reference:** Kleppmann, *Designing Data-Intensive Applications* (1st ed.), Chapter 8, pp. 273–320.

**Scope:** Map every Ch 8 concept — unreliable networks, unreliable clocks, process pauses, knowledge/truth/lies, fencing tokens, system models — onto BenefitsSafe's current patterns. Consolidate the prior Ch 8 audit work (commit `1097bb1` — 4 CRITICAL + 11 HIGH fixes for network failure, retry, and clock drift) into applied-reading form.

Ch 8 is the failure-modes chapter; [`bsrs-ch08-resilience-applied.md`](./bsrs-ch08-resilience-applied.md) is the design-for-resilience applied doc (P1–P6 from a different book). The two complement each other: DDIA Ch 8 names the failure modes, BSRS Ch 8 names the patterns we use to survive them. This doc cross-references BSRS Ch 8 §5 scorecard rather than duplicating it.

**Audit date:** 2026-04-19
**Codebase commit at audit time:** `bc0ff07`
**Prior Ch 8 work:**
- `1097bb1` — "resilience: distributed systems audit — 4 CRITICAL + 11 HIGH fixes for network failure, retry, and clock drift." Every external call + every shared-state mutation catalogued.
- `4fc087a` + Tier 1/2/3 — BSRS Ch 8 P1 Stripe circuit breaker + retrofits. Owner: BSRS applied doc.
- `f9e4c43` + P2b/P2c — BSRS Ch 8 P2 Aurora degraded mode. Owner: BSRS applied doc.
- `06e0cd9` — DDIA Ch 9 audit that added `acquireCronLock` owner tokens (partial fencing). Owner: [`ddia-ch09-consistency-consensus-applied.md`](./ddia-ch09-consistency-consensus-applied.md).

Companion to [`ddia-ch05-replication-applied.md`](./ddia-ch05-replication-applied.md) (replication substrate), [`ddia-ch07-transactions-applied.md`](./ddia-ch07-transactions-applied.md), [`ddia-ch09-consistency-consensus-applied.md`](./ddia-ch09-consistency-consensus-applied.md) (linearizability + ordering + fencing), [`ddia-ch11-stream-processing-applied.md`](./ddia-ch11-stream-processing-applied.md) (event-time clocks), [`ddia-ch12-future-data-systems-applied.md`](./ddia-ch12-future-data-systems-applied.md), and [`bsrs-ch08-resilience-applied.md`](./bsrs-ch08-resilience-applied.md) (the implementation partner).

---

## 0. Stack baseline

- **Compute:** Vercel serverless (Next.js App Router). Per-Lambda freeze/thaw; `maxDuration` caps per handler (60s standard; 300s for cron dispatchers; 15s for financial `$transaction` timeouts).
- **System of record:** AWS Aurora PostgreSQL writer — single linearization point per [`ddia-ch09-consistency-consensus-applied.md`](./ddia-ch09-consistency-consensus-applied.md) §3.
- **External services (every call timeout-bounded):** Stripe (Issuing/Treasury/Billing), QStash (Upstash message broker), Upstash Redis (cache + locks + rate limit), Postmark (transactional email), OFAC screening API (31 CFR Part 501), EIN verification API, Better Stack (logs), Sentry (errors), Cloudflare Workers (router + cron).
- **Every external call has a bounded timeout.** Enumerated in §3. None rely on the SDK default.
- **Every mutation is designed to be retry-safe.** Idempotency keys, natural-key dedup, or compare-and-set gates — see [`ddia-ch12-future-data-systems-applied.md`](./ddia-ch12-future-data-systems-applied.md) §3.1 for the end-to-end identifier inventory.
- **Three clocks in play:** Lambda wall-clock (`new Date()`), Postgres clock (`NOW()`), external producer clocks (e.g. Stripe `event.created`). Per-field selection documented in §4.

The Ch 8 lens on this composition: treat every hop (TCP, function invocation, DB commit, webhook delivery) as potentially partial, reorderable, and subject to clock skew; build in fast-fail + retry + idempotency; never trust a timer as a correctness mechanism.

---

## 1. Faults and Partial Failures (DDIA §8.1)

DDIA §8.1: "In a distributed system, there may well be some parts of the system that are broken in some unpredictable way, even though other parts of the system are working fine. This is known as a partial failure." The hard part is that partial failures are **nondeterministic** — a node doesn't simply "work or not"; it might work for your request and fail for the next one.

### 1.1 Per-dependency failure policy

BenefitsSafe classifies every dependency with an explicit failure policy (fail-CLOSED, fail-OPEN, or bounded-degradation). The policy is documented in code at each call site:

| Dependency | Policy | Rationale | Anchor |
|---|---|---|---|
| Stripe money calls (settlement, card issuance, transfer) | **Fail-CLOSED via circuit breaker** — 503 to client, Retry-After | Double-charging real money is worse than a 30s retry window | [lib/stripe-circuit.ts:86-105](../../lib/stripe-circuit.ts#L86-L105); `CircuitOpenError` → `errorResponse kind: "dependency_unavailable"` |
| OFAC screening at card issuance | **Fail-CLOSED** | 31 CFR Part 501 regulatory requirement — cards CANNOT be issued to un-screened beneficiaries even transiently | [lib/ofac-screening.ts](../../lib/ofac-screening.ts); `1097bb1` replaced a silent `matchFound: false` catch with `OFACScreeningError` that callers 503 |
| OFAC staleness at JIT authorization | **Fail-CLOSED** | Same regulatory posture extended to the approve/decline decision | `1097bb1` fix at [app/api/webhooks/stripe/route.ts](../../app/api/webhooks/stripe/route.ts) — decline on `(eligibility === null) OR (ofacScreened !== true)` |
| QStash delivery | **Fail-CLOSED with retry** | At-least-once semantics; handler idempotency makes this safe | HMAC verification at [lib/queue/index.ts:117-135](../../lib/queue/index.ts#L117-L135) rejects unsigned retries |
| Aurora writer (money writes) | **Fail-CLOSED** | No path to proceed without the source of truth | `DbUnavailableError` at [lib/db-health.ts:65-74](../../lib/db-health.ts#L65-L74); write routes 503 with Retry-After |
| Aurora reader (dashboard + list GETs) | **Bounded degradation** | Serve stale-cache with `_meta.staleness` up to `maxStaleSeconds` | `cachedWithStaleness` at [lib/cache.ts:86-150](../../lib/cache.ts#L86-L150); BSRS Ch 8 P2c |
| Redis (cache / locks / rate limit / dedup) | **Fail-OPEN** with narrow exceptions | Redis is auxiliary; availability > strictness for most paths | `cachedWithStaleness` falls through to DB read; rate limit fails open; `claimJobMessage` returns `true` on Redis error ([lib/queue/index.ts:182-184](../../lib/queue/index.ts#L182-L184)); `acquireCronLock` returns no-op release on Redis error ([lib/queue/index.ts:247-249](../../lib/queue/index.ts#L247-L249)) |
| Postmark (transactional email) | **Fail-OPEN with audit trail** | Missed email is visible to operator via AuditLog; blocking the money tx on an email failure would be the wrong trade-off | `AbortSignal.timeout(5000)` at `1097bb1`; fire-and-forget outside `$transaction` |
| Better Stack logs + Sentry errors | **Fail-OPEN silently** | Observability outage must not impact user requests | Logger at [lib/logger.ts](../../lib/logger.ts); Sentry swallows its own errors |
| Notification fan-out to admins | **Fail-OPEN partial tolerance** | Settlement must not block on notification delivery; operator sees partial fan-out in AuditLog | Fire-and-forget outside the money tx; see [`ddia-ch07-transactions-applied.md`](./ddia-ch07-transactions-applied.md) §2 dispute path |

**Ch 8 observation:** the policy is a conscious choice at each site, not a default. `1097bb1` specifically converted two silent fail-OPEN paths (OFAC network error, OFAC staleness at JIT) into fail-CLOSED because the regulatory posture required it. The classification above is the DDIA §8.1 "partial failure policy" made an explicit per-path table.

Cross-reference [`bsrs-ch08-resilience-applied.md`](./bsrs-ch08-resilience-applied.md) §2.1 "Defense-in-depth layers" for the layered-dependencies view of the same ground.

---

## 2. Unreliable Networks — Detecting Faults (DDIA §8.2)

DDIA §8.2: "Nobody is immune to network problems... the only sure way of detecting a fault is to not get a response from the remote node." BenefitsSafe has three detection layers that compose:

### 2.1 Per-instance circuit breaker — Stripe

[`lib/stripe-circuit.ts`](../../lib/stripe-circuit.ts). Per-Lambda state machine, per-process — deliberate per Ch 8 framing that serverless cold-starts give each instance a fresh view.

- **Rolling window** of last 20 calls ([lib/stripe-circuit.ts:64](../../lib/stripe-circuit.ts#L64)).
- **Error-rate gate:** circuit opens when the window hits ≥ 50% error rate with ≥ 5 samples ([lib/stripe-circuit.ts:67-76](../../lib/stripe-circuit.ts#L67-L76)).
- **MIN_SAMPLES guard** prevents a cold-start's first error from opening the circuit at 1/1 = 100%.
- **Cooldown:** 30s open period, then half-open probe; `Retry-After` header on the 503 response derives from the same constant ([lib/stripe-circuit.ts:58-61](../../lib/stripe-circuit.ts#L58-L61)).
- **READ vs WRITE timeouts:** 3s for retrieve/list, 10s for create/update/delete ([lib/stripe-circuit.ts:78-82](../../lib/stripe-circuit.ts#L78-L82)).
- **Errors pass through unrewrapped:** routes see either Stripe's own error OR `CircuitOpenError` / `CircuitTimeoutError`; never both conflated.

Shipped in BSRS Ch 8 P1 (`4fc087a`) + Tier 1/2/3 retrofits (`399c4e0`, `37cc4ba`, `10ebd00`). Applied at 17 route sites (cross-reference [`bsrs-ch08-resilience-applied.md`](./bsrs-ch08-resilience-applied.md) §P1).

**Ch 8 framing:** this is the DDIA §8.2 "timeout" pattern plus a local observation window that promotes "this call timed out" into "this dependency is currently unhealthy, fast-fail the next call." The per-instance scope is correct — each Lambda independently observes health and recovers independently.

### 2.2 Per-instance cached DB health probe

[`lib/db-health.ts`](../../lib/db-health.ts). Probes Aurora with `SELECT 1`, classifies by latency (healthy < 500ms, degraded < 3000ms, down ≥ 3000ms or timeout), caches the result for 30s per Lambda.

- **Hard kill-timeout:** 5s on the probe itself ([lib/db-health.ts:56](../../lib/db-health.ts#L56)).
- **Status transitions emit structured logs** ([lib/db-health.ts:142-148](../../lib/db-health.ts#L142-L148)) — Better Stack alerts pattern-match `db_health_status_transition` event name.
- **Every write route** calls `assertDbHealthy()` at entry; throws `DbUnavailableError` on "down"; degraded state proceeds with a banner signal.

Shipped in BSRS Ch 8 P2a (`f9e4c43`). Applied at 68 write routes (83 total, 15 exempt — linter at [scripts/lint/db-health-convention.mjs](../../scripts/lint/db-health-convention.mjs) enforces).

**Ch 8 framing:** Kleppmann's §8.2 observation that "detecting faults" is the hard part — the probe is the answer, the cache is the cost-control. Without the 30s cache, the banner's 30s poll × all authenticated users would run a `SELECT 1` on every poll tick. With the cache, the cost is bounded per-Lambda.

### 2.3 Client-side degraded-mode banner

[hooks/useDegradedMode.ts](../../hooks/useDegradedMode.ts). A client hook polls `/api/health` every 30 seconds and exposes `{status: "ok" | "degraded" | "down"}`. Silent on fetch errors (last-known status stays visible — the hook must not become a noise source during transient network blips).

**Ch 8 framing:** detection propagates end-to-end. Server detects degraded state via §2.2; client detects the server's detection via §2.3; the user sees a banner. The failure signal has a deterministic path to the human.

### 2.4 Composition: three layers on one failure

When Aurora starts slowing down, detection fires at three levels in order:

1. **Within one Lambda:** next `assertDbHealthy()` call returns degraded / down. Write routes 503; read routes fall through to `cachedWithStaleness`.
2. **Across Lambdas:** each cold-started Lambda independently observes the slowness via its own probe. The 30s cache means at most 30s of stale classification per instance.
3. **Client-side:** the banner polls `/api/health` on 30s interval; within 60 seconds of the failure, every authenticated user sees the degraded signal.

No cross-instance coordination needed. The per-instance model is correct for the fail-fast goal: serverless doesn't give us shared memory, and we don't want one Lambda's transient glitch to open the circuit for all Lambdas.

---

## 3. Unreliable Networks — Timeouts and Unbounded Delays (DDIA §8.2)

DDIA §8.2 "Timeouts and unbounded delays": every operation that crosses a network boundary must have a bounded timeout, or the whole system inherits that operation's worst-case latency. **BenefitsSafe's timeout budget is fully enumerated.** No external call uses its SDK's default.

| Call | Timeout | Mechanism | Anchor | Shipped |
|---|---|---|---|---|
| Stripe SDK default | **8 s** (SDK-level) + **2 network retries** | `timeout: 8000, maxNetworkRetries: 2` | [lib/stripe.ts:24-28](../../lib/stripe.ts#L24-L28) | `1097bb1` C1 |
| Stripe circuit breaker READ | **3 s** (wraps SDK call) | `DEFAULT_READ_TIMEOUT_MS = 3_000` | [lib/stripe-circuit.ts:79](../../lib/stripe-circuit.ts#L79) | BSRS Ch 8 P1a |
| Stripe circuit breaker WRITE | **10 s** (wraps SDK call) | `DEFAULT_WRITE_TIMEOUT_MS = 10_000` | [lib/stripe-circuit.ts:82](../../lib/stripe-circuit.ts#L82) | BSRS Ch 8 P1a |
| Postmark transactional email | **5 s** | `AbortSignal.timeout(5000)` | [lib/services/email-service.ts](../../lib/services/email-service.ts) | `1097bb1` HIGH |
| EIN verification | **10 s** | `AbortSignal.timeout(10000)` | [lib/ein-verify.ts:63](../../lib/ein-verify.ts#L63) | BSRS Ch 8 P1 Tier work |
| Aurora health probe | **5 s** hard kill | `PROBE_TIMEOUT_MS = 5_000` | [lib/db-health.ts:56](../../lib/db-health.ts#L56) | BSRS Ch 8 P2a |
| Aurora writer connection-acquire | **10 s** | `connectionTimeoutMillis: 10_000` | [lib/db.ts:28-32](../../lib/db.ts#L28-L32) | Ch 5 `c4a796b` Fix 3 |
| Aurora reader connection-acquire | **10 s** | `connectionTimeoutMillis: 10_000` | [lib/db-read.ts:13-17](../../lib/db-read.ts#L13-L17) | Ch 5 `c4a796b` Fix 3 |
| Aurora reader statement | **30 s** | `options=-c statement_timeout=30000` | [lib/db-read.ts:26](../../lib/db-read.ts#L26) | Ch 5 `c4a796b` Fix 3 |
| Vercel handler `maxDuration` (standard) | **60 s** | Per-route `export const maxDuration = 60` | route files |  |
| Vercel handler `maxDuration` (cron dispatcher) | **300 s** | Per-route `export const maxDuration = 300` | cron dispatcher routes |  |
| Prisma `$transaction` (financial) | **15 s** | `{ maxWait: 5_000, timeout: 15_000 }` | Ch 7 Serializable sites | Ch 7 |

### 3.1 The "why 8 seconds for Stripe" derivation

Stripe SDK defaults: `timeout: 80000, maxNetworkRetries: 0`. Both are wrong for fintech serverless:

- **80s exceeds Vercel's function budget** (60s standard, 10s on free tier). A Stripe call that hits the 80s SDK timeout would never surface — the Lambda is already dead.
- **Zero retries means a single TCP blip on a money call bubbles as a 500.** Users see "server error" on a transient network event.

The Ch 8 `1097bb1` fix: `timeout: 8000, maxNetworkRetries: 2`. 8 seconds leaves headroom for retries + our own DB writes within a 60s Lambda budget; 2 retries absorb transient network errors. Stripe-node applies exponential backoff internally and respects the `Idempotency-Key` header, so our deterministic keys (Ch 12 74cf1f0 end-to-end pattern; cross-reference [`ddia-ch12-future-data-systems-applied.md`](./ddia-ch12-future-data-systems-applied.md) §3) make the retries safe on money-moving calls.

The circuit breaker's 3s READ / 10s WRITE compose with the 8s SDK timeout: for READ the circuit fires first (3s); for WRITE the SDK fires first (8s) and the error counts toward the circuit's rolling window. Both are correct.

### 3.2 Pool exhaustion as an unbounded-delay pattern

[lib/db.ts:28-32](../../lib/db.ts#L28-L32) + [lib/db-read.ts:13-17](../../lib/db-read.ts#L13-L17):

```ts
const POOL_CONFIG = {
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
} as const;
```

Shipped in Ch 5 `c4a796b` Fix 3. The Ch 8 framing: without `connectionTimeoutMillis`, a pool-acquire under Aurora failover would wait until TCP timeout — minutes — and the caller would either hit Vercel `maxDuration` or pile up behind it. The 10s fast-fail converts "unbounded pool wait" into `DbUnavailableError` + `Retry-After` in a deterministic window.

The `max: 5` ceiling is a different Ch 8 concern: **connection-pool fan-out across serverless instances.** At 200 warm Lambdas × 10 connections each = 2000 connections vs Aurora's ~1000 `max_connections`. The old default was a timed-bomb waiting for traffic growth. `max: 5` × 200 warm = 1000 connections, fits behind RDS Proxy.

Cross-reference [`ddia-ch05-replication-applied.md`](./ddia-ch05-replication-applied.md) §A3 for the full sizing rationale.

### 3.3 Bounded retry loops

Three places where a bounded loop caps an otherwise unbounded retry:

- **Reconciliation ledger-retrieve loop:** `LEDGER_RETRIEVE_BUDGET = 500` per run ([app/api/cron/reconciliation/route.ts](../../app/api/cron/reconciliation/route.ts)). Without this, at steady state the monthly reconciliation cron would run `stripe.issuing.transactions.retrieve` against every DEBIT — 17M calls at projected scale — guaranteed to timeout or OOM.
- **`retryOnSerializationFailure`:** 3 attempts, exponential backoff 50→100→200ms + ±25% jitter ([lib/db.ts:80-116](../../lib/db.ts#L80-L116)). Catches Postgres 40001/40P01/P2034 on Serializable tx. Bounded retries prevent an unlucky sequence from looping forever.
- **Code-generator retry loop:** `orgCode` / `vendorCode` / `memberCode` use MAX+1 + P2002 retry with a 3-attempt cap ([app/api/vendors/route.ts:327-369](../../app/api/vendors/route.ts#L327-L369)). Above 3, throws a structured error instead of looping — cross-reference [`ddia-ch09-consistency-consensus-applied.md`](./ddia-ch09-consistency-consensus-applied.md) §7 P6 for the proposed `SEQUENCE`-based replacement.

**Ch 8 observation:** every retry has a budget; every retry budget is named in code; every exhaustion path is an explicit error the operator can alert on.

---

## 4. Unreliable Clocks (DDIA §8.3)

DDIA §8.3 distinguishes **monotonic clocks** (measuring elapsed time) from **time-of-day clocks** (wall-clock, subject to NTP skew, leap seconds, drift). The correctness argument: never use a time-of-day clock as a correctness mechanism across system boundaries.

### 4.1 The three clocks

BenefitsSafe has three clocks in play:

| Clock | Authoritative for | Skew bound | Use pattern |
|---|---|---|---|
| **Lambda wall-clock** (`new Date()`, `Date.now()`) | Processing-time only | NTP-synchronized by Vercel; typically sub-100ms drift from UTC | Processing-time labels, coarse cron windows, `startOfToday` dedup windows |
| **Postgres clock** (`NOW()`, `@default(now())`) | Event-time for DB-sourced events | Cluster-synchronous by AWS Aurora; all Lambdas see the same clock | Event-time windowing (card-expiration Pass 2), `createdAt` on append-only tables, `expiresAt` comparisons |
| **External producer clocks** — Stripe `event.created`, QStash message timestamps | Event-time for external-sourced events | Producer-side (out of our control) | Ordering guards — `BillingSubscription.lastBillingEventAt` |

### 4.2 Per-field clock selection rule

Documented in [`ddia-ch11-stream-processing-applied.md`](./ddia-ch11-stream-processing-applied.md) §5 and re-affirmed here: **use the producer's clock for events that crossed a system boundary; use the DB clock for events rooted in DB state; reserve the Lambda clock for processing-time labels where drift cannot cause correctness bugs.**

The canonical case study is `card-expiration` Pass 2 at [app/api/cron/card-expiration/route.ts:248-295](../../app/api/cron/card-expiration/route.ts#L248-L295). Pre-fix, both bounds of the 7-day "expiring soon" window came from the Lambda clock. If the cron ran late for any reason, cards whose expiry fell inside the lag window would silently miss the notification. The fix swapped to `NOW()` inside the raw SQL, anchoring the comparison to the DB clock — the same clock that wrote `expiresAt` in the first place. No cross-clock drift possible.

### 4.3 Clock-sensitive idempotency keys — the pattern we left behind

DDIA §8.3 warns against "time-bucketed" tokens. BenefitsSafe has three survivors of this pattern:

| Key | Bucket | Status |
|---|---|---|
| `checkout-${orgId}-${tier}-${5-minute-bucket}` | 5 min | SAFE — session endpoint, dedupes quick double-clicks; legitimate later attempts get a fresh session |
| `billing-portal-${orgId}-${5-minute-bucket}` | 5 min | SAFE — same rationale |
| `ibt-${orgId}-${amount}-${paymentMethod}-${5-minute-bucket}` (ACH) | 5 min | **FIXED** in Ch 12 `74cf1f0` — superseded by end-to-end `FundTransfer.requestId` UUID pattern. The original was the exact Ch 8 hazard: a retry across the bucket boundary produced a different key, Stripe treated it as fresh, real-money double-pull. |

**Ch 8 framing:** session endpoints can use time-bucketed keys because session creation is **idempotent in intent** — a double-click should produce one session, but a legitimate separate attempt later deserves a fresh one. Money movement cannot — every retry of the same user intent must produce the same result. The shift from bucket to end-to-end UUID for money is the Ch 8 pattern made material.

### 4.4 Lambda clock hazards — enumerated

| Hazard | Mitigation | Anchor |
|---|---|---|
| NTP drift between Lambdas and Aurora | Event-time comparisons use DB clock; Lambda clock only for processing-time labels | §4.2 |
| Leap-second smearing / negative time jumps | No wall-clock subtractions for correctness; bounded retry loops use relative sleep | retry helpers in [lib/db.ts](../../lib/db.ts) |
| Frozen clock during Lambda suspend | Detection via `assertDbHealthy()` on wake — if Aurora is unreachable after resume, 503 before any write | §2.2 |
| Stripe clock drift from ours | Ordering guards use Stripe `event.created` directly (not our received-time) — cross-reference [`ddia-ch09-consistency-consensus-applied.md`](./ddia-ch09-consistency-consensus-applied.md) §4.1 | `stripe-billing` `lastBillingEventAt` |

No current incidents attributable to clock drift. The discipline is in place; monitoring NTP drift directly is deferred (F2 below) until either a platform signal or a real incident warrants it.

---

## 5. Process Pauses (DDIA §8.4 "Process pauses")

DDIA §8.4: a process can be paused arbitrarily by GC, STW collections, OS scheduling, VM suspension. A lock held across a pause can expire while the holder is paused, letting a second worker acquire it — classic split-brain.

### 5.1 The serverless analog

BenefitsSafe runs on Vercel serverless. The DDIA process-pause model maps with differences:

- **No GC-style STW pause** to worry about at Node's scale on a short-lived handler.
- **Lambda freeze/thaw** when an instance goes idle — analogous to a long pause, but typically resumes cleanly with DB/network connections re-established.
- **`maxDuration` hard-kill** — the real hazard. A Lambda that exceeds its budget is terminated by the runtime; `finally` blocks do NOT run.

### 5.2 Owner-token locks as the mitigation

[lib/queue/index.ts:225-261](../../lib/queue/index.ts#L225-L261). `acquireCronLock` generates a `crypto.randomUUID()` owner token per acquisition, stores it as the Redis value under the lock key with a TTL, and releases via Lua compare-and-delete:

```
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
```

The DDIA Ch 8 split-brain scenario:

1. Handler A acquires the lock, starts processing.
2. Handler A's Lambda is paused / hard-killed past the TTL.
3. Redis expires the key automatically.
4. Handler B acquires a fresh lock (new owner UUID).
5. Handler A eventually wakes up and runs `release()`.

Without owner tokens, step 5 would `DEL` the key, unlocking handler B's in-flight run; handler C could then grab it and overlap with B. **With owner tokens,** step 5 reads the value, sees it no longer matches A's UUID, and the Lua script returns 0 — B's lock stays intact.

Shipped in `06e0cd9` (Ch 9 audit). Cross-reference [`ddia-ch09-consistency-consensus-applied.md`](./ddia-ch09-consistency-consensus-applied.md) §5.3 for the explicit choice not to extend to monotonic fencing tokens.

### 5.3 Residual hard-kill exposure

[lib/webhook-idempotency.ts:29-84](../../lib/webhook-idempotency.ts#L29-L84). A handler that inserts the `ProcessedWebhookEvent` row, begins processing, then hits `maxDuration` → Vercel kills the function → `finally` block does NOT run → row stays → next Stripe retry sees `deduped: true` → the event is permanently dropped.

Mitigation today: Stripe retries for 3 days (~72 attempts), so the window of exposure is narrow. Every handler sets `maxDuration: 60` (or `300` for long crons) — generous enough that hard kills are rare under normal operation.

Tracked as `ddia-ch09-consistency-consensus-applied.md` §7 P5 with a two-phase claim/commit or external reconciliation fix when triggered. **Not re-proposed here.**

### 5.4 Retry as process-pause recovery

DDIA §8.4: a process pause can be indistinguishable from a node failure, so the system must assume either and handle both. BenefitsSafe's pattern: every mutation is idempotent, so a retry after a pause (whether the original handler completed or not) produces the same end state. Cross-reference [`ddia-ch12-future-data-systems-applied.md`](./ddia-ch12-future-data-systems-applied.md) §3 for the end-to-end identifier inventory that makes this work.

---

## 6. Knowledge, Truth, and Lies (DDIA §8.4)

DDIA §8.4 splits the topic into three sub-concerns: the majority principle (truth is what the majority agrees), Byzantine faults (what if some nodes actively lie), and fencing tokens (how do you keep a zombie from corrupting shared state).

### 6.1 Truth by leader, not by majority

BenefitsSafe's consistency model is **truth-by-leader**, not truth-by-majority:

- Aurora's single writer is the sole linearization point. Cross-reference [`ddia-ch09-consistency-consensus-applied.md`](./ddia-ch09-consistency-consensus-applied.md) §3.
- We don't run Paxos / Raft / ZooKeeper / etcd at the app layer.
- The two failure domains (BSRS Ch 8 P3 canary + stable) share one writer by design — see [bsrs-ch08-p3-design.md](./bsrs-ch08-p3-design.md) §5.

**Ch 8 framing:** DDIA's §8.4 "majority" argument applies to systems that don't have a designated leader. When a single-leader storage system (Aurora) provides truth-by-leader semantics transparently, the app layer doesn't need to construct a quorum — it inherits one from the storage layer.

**Forward-looking constraint:** if a future PDR introduces a second Aurora writer (multi-region active-active), the truth-by-leader assumption breaks. §6 of that future doc would need a real quorum discussion. Today: not applicable. Cross-reference F5 below.

### 6.2 Fencing tokens — owner tokens, not monotonic

DDIA §8.4 "Fencing tokens" recommends a monotonic token on every lock that every downstream write validates. Martin Kleppmann's canonical blog post ([https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html](https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html)) frames this as the Redis-lock-without-fencing vulnerability.

BenefitsSafe's choice:

- **Owner tokens at the lock** — UUID-per-acquisition + Lua CAS release. See §5.2.
- **Natural-key uniqueness at the storage layer** — 20 `@unique` / `@@unique` declarations, `ProcessedWebhookEvent.id @id` keyed on external event id, `claimJobMessage` SET NX per message id, `LedgerEntry.reference` natural-key dedup. See [`ddia-ch12-future-data-systems-applied.md`](./ddia-ch12-future-data-systems-applied.md) §4.

**Why not monotonic fencing.** Documented in [lib/queue/index.ts:208-218](../../lib/queue/index.ts#L208-L218):

> "It does NOT provide full fencing tokens (monotonic counters validated on every downstream write) — the cron jobs in this codebase all rely on DB-level entity idempotency (unique constraints, `claimJobMessage`, per-warning `entityId` dedup) as the real line of defense. The owner token is the minimum hardening that keeps the lock itself safe to release."

**Ch 8 observation:** this is an intentional simplification. Kleppmann's fencing argument addresses "what if a zombie worker's DB write lands after a fresh worker's DB write?" — the DB couldn't reject the zombie without a monotonic token. BenefitsSafe's answer: every zombie write either hits a natural-key uniqueness constraint (P2002, reject), a compare-and-set gate (`updateMany WHERE status = expected` returns `count: 0`, no-op), or `LedgerEntry.reference` dedup. The DB IS the fence, and the DB doesn't need a monotonic token to enforce uniqueness.

Cross-reference [`ddia-ch09-consistency-consensus-applied.md`](./ddia-ch09-consistency-consensus-applied.md) §5.3 for the full reasoning.

### 6.3 Byzantine faults — trust the monolith, verify the boundaries

DDIA §8.4 "Byzantine faults": what if some nodes aren't just crashed, but actively malicious (sending wrong data, forging messages)? Most systems don't defend against this internally (trust-the-monolith); they DO defend at external boundaries.

BenefitsSafe's Byzantine posture:

| Boundary | Defense | Anchor |
|---|---|---|
| Stripe webhook → us | `stripe.webhooks.constructEvent()` Ed25519-signature verification with `STRIPE_WEBHOOK_SECRET` (+ `STRIPE_BILLING_WEBHOOK_SECRET`, `STRIPE_CHARGES_WEBHOOK_SECRET`) | [app/api/webhooks/stripe/route.ts:82-95](../../app/api/webhooks/stripe/route.ts#L82-L95) + siblings |
| QStash → us | `Receiver.verify()` EdDSA HMAC over raw body + URL with current + next signing keys | [lib/queue/index.ts:117-135](../../lib/queue/index.ts#L117-L135) |
| Client browser → us | zod validation on every request body (+ NextAuth session verification) | schemas across [lib/validations/](../../lib/validations/) and inline on routes |
| Cloudflare router Worker → us (cron invocations) | Bearer token validation against `CRON_SECRET` | [lib/cron-auth.ts](../../lib/cron-auth.ts); every cron route wraps `if (!validateCronSecret(request)) return 401` |
| Any source → SQL | Prisma parameterization (no `$queryRawUnsafe` except on audited migration scripts) | throughout |
| OFAC API → us | JSON-schema parse + fail-CLOSED on unknown shape | [lib/ofac-screening.ts](../../lib/ofac-screening.ts) |
| EIN API → us | Bounded timeout + `{ verified: false, status: "timeout" }` structured fallback | [lib/ein-verify.ts:98](../../lib/ein-verify.ts#L98) |

**Ch 8 framing:** DDIA argues Byzantine defense is expensive; the pragmatic choice is "Byzantine at external boundaries, trusted-reliable internally." That's BenefitsSafe's choice, made explicit at each boundary. The `1097bb1` fix for QStash (replacing presence-of-header with real HMAC verification) was a Byzantine-defense correction — the old code trusted any header-bearing request as authentic.

### 6.4 What we don't do

- **Quorum-based consensus at the app layer** — not needed, Aurora provides it.
- **Merkle-tree-style anti-entropy** — no multi-replica app state.
- **Byzantine fault tolerance for internal calls** — we trust our own monolith. If the monolith is compromised, Byzantine verification between its internal modules wouldn't save us.

---

## 7. System Model (DDIA §8.5)

DDIA §8.5 gives the matrix: pick one timing model × one fault model.

**Timing models:**
- Synchronous — bounded message delay, bounded clock drift.
- Partially synchronous — usually synchronous, occasionally unbounded.
- Asynchronous — no timing guarantees at all.

**Fault models:**
- Crash-stop — a node fails and never comes back.
- Crash-recovery — a node can fail and rejoin; local disk persists across reboots.
- Byzantine — nodes can behave arbitrarily (including maliciously).

### 7.1 BenefitsSafe's model — named explicitly

**Timing: partially synchronous.** Most external calls complete in sub-second; timeouts (§3) bound the worst case. NTP keeps wall clocks in sub-100ms-drift range in practice. But the system assumes — and codes against — the possibility of an unbounded delay on any hop. That's the DDIA §8.5 partially-synchronous contract.

**Faults: crash-recovery, not crash-stop.** Lambda freeze/thaw, Aurora failover, Redis Upstash transient unavailability — every component can fail and come back. Our code assumes durable state survives (Aurora WAL + PITR; Redis can lose data, which is why we only put derived/optional state in Redis).

**Byzantine at external boundaries only.** Stripe, QStash, client, Cloudflare Worker, OFAC, EIN are verified as non-Byzantine via signatures / HMAC / tokens / schema validation (§6.3). Inside the monolith, modules trust each other — there is no intra-service signature verification.

### 7.2 Why this matters

DDIA §8.5 argues that the system model defines what algorithms work. An algorithm that requires synchronous timing (say, group membership via heartbeats within bounded time) is broken if your system is actually partially synchronous. An algorithm that assumes crash-stop is broken under crash-recovery (stale state on the returning node).

Naming the model explicitly: future algorithm choices have a named constraint to check against. If someone proposes an optimization that assumes "clock drift is always < 10ms" or "a node once failed never returns," the model says no.

**Ch 8 observation:** this is process discipline, not code. The model statement lives in this doc and is referenced when architectural decisions touch distributed properties — e.g., when evaluating whether BSRS Ch 8 P3 can grow into active-active (F5 below — it cannot without revisiting the model).

---

## 8. Interaction with BSRS Ch 8 (implementation partner)

[`bsrs-ch08-resilience-applied.md`](./bsrs-ch08-resilience-applied.md) §5 scorecard lists P1–P6. DDIA Ch 8 is the **failure-modes** chapter; BSRS Ch 8 is the **patterns-to-survive** chapter. The mapping:

| DDIA Ch 8 concern | BSRS Ch 8 P-item that addresses it | Ship state |
|---|---|---|
| §8.2 Detecting faults — slow external dependency | **P1** Stripe circuit breaker | CLOSED |
| §8.1 Partial failure — DB degraded serving | **P2** Aurora degraded mode (P2a probe, P2b write-gate, P2c stale-cache reads) | CLOSED |
| §8.1 Failure-domain isolation — bad deploy | **P3** Two failure domains (canary / stable) | CODE CLOSED; infra pending |
| §8.5 Operational discipline — credential rotation reveals silent breakage | **P4** Key rotation schedule + measurement | CLOSED |
| §8.5 Model validation — assumptions hold under synthetic load | **P5** Load testing + chaos toggles + game-day playbook | FOUNDATIONS CLOSED |
| §8.1 "Low-dep tier" + multi-region | **P6** Deferred | DEFERRED |

DDIA Ch 8's contribution is the vocabulary (partial failure, unbounded delay, crash-recovery, Byzantine-at-boundaries, owner-token-not-monotonic-fencing, partially-synchronous-system-model). BSRS Ch 8's contribution is the shipping P1–P5. The two docs name the same ground from different angles.

---

## 9. Open Issues and Action Items

Three-way split: **ALREADY-FIXED** (document, don't re-propose), **CURRENT-STATE** (name what exists), **FUTURE-STATE** (deferred with triggers).

### 9.A ALREADY-FIXED (from `1097bb1` + subsequent Ch 8-adjacent work)

| A# | Item | DDIA § | Commit | Anchor |
|---|---|---|---|---|
| **A1** | Stripe client: 8s timeout + 2 network retries | §8.2 Timeouts | `1097bb1` CRITICAL | [lib/stripe.ts:24-28](../../lib/stripe.ts#L24-L28) |
| **A2** | QStash `verifyJobAuth` real EdDSA HMAC verification (was presence-of-header trust) | §8.4 Byzantine boundary | `1097bb1` CRITICAL | [lib/queue/index.ts:117-135](../../lib/queue/index.ts#L117-L135) |
| **A3** | OFAC screening fail-CLOSED (lib + 3 call sites) | §8.1 Fail-closed policy | `1097bb1` CRITICAL | [lib/ofac-screening.ts](../../lib/ofac-screening.ts); applied at expense + grant issue-card routes |
| **A4** | `retryOnSerializationFailure()` + applied to approve path | §8.2 Retry with bounded budget | `1097bb1` HIGH | [lib/db.ts:80-116](../../lib/db.ts#L80-L116) |
| **A5** | OFAC staleness at JIT authorization fail-CLOSED | §8.1 Fail-closed extended to the real-time path | `1097bb1` HIGH | [app/api/webhooks/stripe/route.ts](../../app/api/webhooks/stripe/route.ts) |
| **A6** | Postmark `AbortSignal.timeout(5000)` | §8.2 Timeouts | `1097bb1` HIGH | [lib/services/email-service.ts](../../lib/services/email-service.ts) |
| **A7** | `claimJobMessage` Redis SET NX + `acquireCronLock` Redis lock | §8.4 Knowledge — dedup + locks | `1097bb1` HIGH | [lib/queue/index.ts:169-261](../../lib/queue/index.ts#L169-L261) |
| **A8** | 5 QStash receivers claim `Upstash-Message-Id`; 6 cron handlers acquire cron lock | §8.4 Effectively-once | `1097bb1` HIGH | `app/api/jobs/*` + `app/api/cron/*` |
| **A9** | Reconciliation `LEDGER_RETRIEVE_BUDGET=500` bound | §8.2 Prevent unbounded retry loop | `1097bb1` HIGH | [app/api/cron/reconciliation/route.ts](../../app/api/cron/reconciliation/route.ts) |
| **A10** | `reconcile-orphan-stripe-cards` hourly sweeper | §8.1 Recovery from partial failure (Stripe create succeeded + DB row didn't) | `1097bb1` HIGH (NEW file) | [app/api/cron/reconcile-orphan-stripe-cards/route.ts](../../app/api/cron/reconcile-orphan-stripe-cards/route.ts) |
| **A11** | Deterministic Stripe idempotency keys on 4 endpoints | §8.4 Stable identity across retries | `1097bb1` HIGH | auth/register, billing/checkout, billing/portal, org/stripe-onboarding |
| **A12** | BSRS Ch 8 P1 Stripe circuit breaker (successor to A1 timeout-only) | §8.2 Detecting faults — local observation window | `4fc087a` + 3 tier retrofits | [lib/stripe-circuit.ts](../../lib/stripe-circuit.ts) |
| **A13** | BSRS Ch 8 P2a DB health probe + P2c stale-cache reads | §8.1 Degraded serving + §8.2 detection | `f9e4c43` + P2c Phase 1-3 | [lib/db-health.ts](../../lib/db-health.ts) + [lib/cache.ts](../../lib/cache.ts) |
| **A14** | `acquireCronLock` owner-token + Lua CAS release (partial fencing) | §8.4 Fencing tokens (partial) | `06e0cd9` | [lib/queue/index.ts:194-261](../../lib/queue/index.ts#L194-L261) |
| **A15** | Connection pool sizing (max:5, 30s idle, 10s connect) across writer + reader clients | §8.2 Prevent pool-acquire unbounded wait + pool-exhaustion blowout | Ch 5 `c4a796b` | [lib/db.ts:28-32](../../lib/db.ts#L28-L32), [lib/db-read.ts:13-17](../../lib/db-read.ts#L13-L17) |

### 9.B CURRENT-STATE (document, no code change)

| C# | Item | DDIA § | Anchor |
|---|---|---|---|
| **C1** | Full timeout-budget table — every external call bounded, every limit cited | §8.2 Timeouts | §3 table |
| **C2** | Three-clock taxonomy — Lambda wall-clock / Postgres NOW() / external producer clock — with per-field selection rule | §8.3 Unreliable clocks | §4; cross-ref Ch 11 §5 |
| **C3** | Fail-CLOSED vs fail-OPEN per-dependency policy table | §8.1 Partial-failure policy | §1.1 |
| **C4** | Three-layer detection composition — per-instance circuit / cached probe / client banner | §8.2 Detecting faults | §2 |
| **C5** | Owner-token locks, not monotonic fencing — conscious simplification, DB is the real fence | §8.4 Fencing tokens | §6.2; cross-ref Ch 9 §5.3 |
| **C6** | Byzantine-boundary defense surface — signatures / HMAC / zod / Prisma params / Bearer tokens | §8.4 Byzantine | §6.3 |
| **C7** | Named system model — partially synchronous + crash-recovery + Byzantine-at-boundaries | §8.5 System model | §7 |
| **C8** | Residual hard-kill exposure on `releaseWebhookEvent` — narrow window, Stripe retry covers | §8.4 Process pauses — hard kill | §5.3; cross-ref Ch 9 §7 P5 |

### 9.C FUTURE-STATE (deferred with triggers)

Every item here is **don't build now**. Each row states the signal under which the decision flips.

| F# | Item | DDIA § | Trigger |
|---|---|---|---|
| **F1** | Full monotonic fencing tokens on cron handlers (beyond owner-token) | §8.4 Fencing tokens | A crash-recovery incident where owner-token + DB natural-key uniqueness proved insufficient. Today no such incident. |
| **F2** | NTP drift monitoring on Vercel Lambdas | §8.3 Unreliable clocks | Vercel docs acknowledge drift OR we see a real drift incident. Today no signal. |
| **F3** | Explicit `maxDuration` audit per handler — p99 headroom vs timeout ceiling | §8.4 Process pauses | p99 handler latency approaches `maxDuration` bounds on any critical path |
| **F4** | Replace webhook `releaseWebhookEvent` hard-kill residual with two-phase claim/commit OR daily Stripe-events reconciliation cron | §8.4 Knowledge — idempotency under hard-kill | Ch 9 P5 trigger (Better Stack alert on Stripe event-count drift). Cross-reference [`ddia-ch09-consistency-consensus-applied.md`](./ddia-ch09-consistency-consensus-applied.md) §7 P5 — don't duplicate. |
| **F5** | Quorum-based consensus if Aurora ever goes dual-writer | §8.4 Truth by majority | Active-active multi-region Aurora is considered. Today: shared writer across channels per BSRS Ch 8 P3 design. |
| **F6** | Formal partial-failure game-day scenarios beyond BSRS Ch 8 P5 playbook | §8.5 Model validation | First quarterly game-day runs, surfaces untested failure modes — cross-reference [`bsrs-ch08-resilience-applied.md`](./bsrs-ch08-resilience-applied.md) §P5 |
| **F7** | Chaos-injection middleware (P5b deferred from BSRS Ch 8 P5) | §8.5 Continuous model validation | BSRS P5 game-day surfaces a scenario where manual injection isn't enough |

---

## 10. What this audit establishes

DDIA Chapter 8 discipline is broadly applied at BenefitsSafe:

- **Partial failure is a first-class consideration** — every dependency has a named failure policy (§1.1), every external call is timeout-bounded (§3), every retry has a budget.
- **Fault detection is layered** — per-instance circuit + cached probe + client banner (§2). No cross-instance coordination required for failure-awareness.
- **Clocks are used correctly** — producer clock for external events, DB clock for DB-sourced events, Lambda clock only for processing-time labels (§4). The `card-expiration` Pass 2 fix is the case study.
- **Process pauses are absorbed by owner-token locks + idempotency** — zombies can't corrupt state because the DB is the fence (§5, §6.2).
- **Byzantine defense is at external boundaries only** — Stripe signatures, QStash HMAC, zod, Prisma parameterization, Bearer tokens (§6.3). The monolith trusts itself.
- **System model is named** — partially synchronous + crash-recovery + Byzantine-at-boundaries (§7). Future architecture decisions have a named constraint to check.
- **Remaining gaps are narrow** — F4 hard-kill residual (cross-ref Ch 9 P5), F2 NTP drift monitoring (no signal), F3 `maxDuration` p99 audit (not close today), F5 quorum (no dual-writer). None are on the critical path.

The partnership is explicit: **DDIA Ch 8 names the failure modes; BSRS Ch 8 ships the patterns that survive them.** Both docs are load-bearing.

---

## 11. Cross-chapter ties

- **DDIA Ch 5 (Replication):** §8.2 connection-pool sizing fix was part of `c4a796b`; §8.1 webhook event-loss fix was also Ch 5's Fix 2. This doc cites both; cross-reference [`ddia-ch05-replication-applied.md`](./ddia-ch05-replication-applied.md).
- **DDIA Ch 7 (Transactions):** §8.2 `retryOnSerializationFailure` is the Ch 7 serialization-retry primitive applied to the approve path. Cross-reference [`ddia-ch07-transactions-applied.md`](./ddia-ch07-transactions-applied.md) §2.
- **DDIA Ch 9 (Consistency and Consensus):** §6.2 fencing-token choice (owner tokens, not monotonic); §8.4 webhook hard-kill exposure (Ch 9 P5). Cross-reference [`ddia-ch09-consistency-consensus-applied.md`](./ddia-ch09-consistency-consensus-applied.md) §5.3 + §7 P5.
- **DDIA Ch 11 (Stream Processing):** §4 three-clock taxonomy is the Ch 11 event-time vs processing-time argument. Cross-reference [`ddia-ch11-stream-processing-applied.md`](./ddia-ch11-stream-processing-applied.md) §5.
- **DDIA Ch 12 (Future of Data Systems):** §3 end-to-end identifiers + §6.3 Byzantine defense both connect to Ch 12 correctness framing. Cross-reference [`ddia-ch12-future-data-systems-applied.md`](./ddia-ch12-future-data-systems-applied.md) §3 + §4.
- **BSRS Ch 8 (Design for Resilience):** the implementation partner. Every DDIA concern in §1–§7 maps to a BSRS P-item (§8 table). Cross-reference [`bsrs-ch08-resilience-applied.md`](./bsrs-ch08-resilience-applied.md) §5 scorecard.

---

## 12. Open questions for a future session

- **When does owner-token fencing become insufficient?** Trigger for F1. Today no incident; monitoring via Better Stack structured logs on `cron lock release failed` would surface a signal.
- **NTP drift monitoring as infrastructure:** worth it at current scale? F2 trigger is "Vercel documents drift issues." The alternative is to add a Better Stack alert on the existing `db_health_status_transition` + `card-expiration` logs for anomalies that could be drift-caused.
- **`maxDuration` p99 headroom** — should F3 become a routine pre-launch gate rather than trigger-driven? The answer depends on whether BSRS Ch 8 P5 game-day scenarios include a "handler approaches maxDuration" scenario.
- **Game-day scenarios beyond BSRS Ch 8 P5 playbook.** Candidate additions: (a) cold-start burst (100 simultaneous Lambda spin-ups against Aurora), (b) Redis extended outage (24h, not the transient 30s), (c) Stripe API degradation (500 errors on 50% of calls for 10 minutes), (d) Cloudflare Worker outage (can't cron, can't route).
- **If we ever add a second Aurora writer** (F5), §7 system model needs a real quorum discussion and §6.1 truth-by-leader breaks. That PDR is speculative today.

---

## References

- Kleppmann, *Designing Data-Intensive Applications*, 1st ed., O'Reilly 2017. Chapter 8.
- Martin Kleppmann, "How to do distributed locking" (fencing tokens): [https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html](https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html).
- Prior Ch 8 audit commit: `1097bb1`.
- DDIA Ch 5 applied doc: [`ddia-ch05-replication-applied.md`](./ddia-ch05-replication-applied.md).
- DDIA Ch 7 applied doc: [`ddia-ch07-transactions-applied.md`](./ddia-ch07-transactions-applied.md).
- DDIA Ch 9 applied doc: [`ddia-ch09-consistency-consensus-applied.md`](./ddia-ch09-consistency-consensus-applied.md).
- DDIA Ch 11 applied doc: [`ddia-ch11-stream-processing-applied.md`](./ddia-ch11-stream-processing-applied.md).
- DDIA Ch 12 applied doc: [`ddia-ch12-future-data-systems-applied.md`](./ddia-ch12-future-data-systems-applied.md).
- BSRS Ch 8 applied doc: [`bsrs-ch08-resilience-applied.md`](./bsrs-ch08-resilience-applied.md).
- BSRS Ch 8 P3 design: [`bsrs-ch08-p3-design.md`](./bsrs-ch08-p3-design.md).
- Stripe circuit breaker: [`../../lib/stripe-circuit.ts`](../../lib/stripe-circuit.ts).
- DB health probe: [`../../lib/db-health.ts`](../../lib/db-health.ts).
- Client degraded-mode hook: [`../../hooks/useDegradedMode.ts`](../../hooks/useDegradedMode.ts).
- QStash + cron-lock helpers: [`../../lib/queue/index.ts`](../../lib/queue/index.ts).
- OFAC fail-CLOSED: [`../../lib/ofac-screening.ts`](../../lib/ofac-screening.ts).
- Orphan Stripe-card sweeper: [`../../app/api/cron/reconcile-orphan-stripe-cards/route.ts`](../../app/api/cron/reconcile-orphan-stripe-cards/route.ts).

---

*Generated 2026-04-19 during BenefitsSafe security-hardening session. Verified against commit `bc0ff07`. Scorecard mirrors Ch 7 / Ch 9 / Ch 11 / Ch 12 format for cross-doc consistency.*

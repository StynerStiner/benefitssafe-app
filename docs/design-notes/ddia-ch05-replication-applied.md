# DDIA Chapter 5 (Replication) Applied to BenefitsSafe

**Reference:** Kleppmann, *Designing Data-Intensive Applications* (1st ed.), Chapter 5, pp. 151–220.

**Scope:** Map every Ch 5 concept — leaders and followers, synchronous vs asynchronous replication, node outages, replication lag, read-your-writes, monotonic reads, consistent prefix reads, multi-leader and leaderless replication — onto BenefitsSafe's current patterns. **Be honest about what applies:** BenefitsSafe uses Aurora single-leader replication managed by AWS. Multi-leader and leaderless replication are not used; each gets one paragraph explaining why and what would trigger reconsideration.

Consolidates the prior Ch 5 audit work (commit `c4a796b` — "3 critical replication blockers" — cross-org bypass collapse, webhook event-loss on Aurora failover, connection pool sizing, plus cache invalidation wiring) into applied-reading form.

**Audit date:** 2026-04-19
**Codebase commit at audit time:** `daea13c`
**Prior Ch 5 work:**
- `c4a796b` — "security: 3 critical replication blockers — cross-org bypass, webhook event loss, connection pooling." Framed explicitly as a DDIA Ch 5 audit.

Companion to [`ddia-ch07-transactions-applied.md`](./ddia-ch07-transactions-applied.md), [`ddia-ch08-distributed-systems-applied.md`](./ddia-ch08-distributed-systems-applied.md) (shares Fix 3 connection pool sizing), [`ddia-ch09-consistency-consensus-applied.md`](./ddia-ch09-consistency-consensus-applied.md) (cites Ch 5 for webhook idempotency), [`ddia-ch11-stream-processing-applied.md`](./ddia-ch11-stream-processing-applied.md) (cites Ch 5 for `ProcessedWebhookEvent`), [`ddia-ch12-future-data-systems-applied.md`](./ddia-ch12-future-data-systems-applied.md), and [`bsrs-ch08-resilience-applied.md`](./bsrs-ch08-resilience-applied.md) (P2c stale-cache reads as the replication-lag mitigation).

---

## 0. Stack baseline

- **Primary storage:** AWS Aurora PostgreSQL, cluster-writer endpoint. One logical writer; all mutations go through it. No application-layer sharding.
- **Aurora storage replication:** 6 copies across 3 availability zones, synchronous at the storage layer. Managed by AWS — opaque to the application.
- **PITR + automated backups:** Aurora's point-in-time recovery window, operator-configurable retention.
- **Read replica client:** [lib/db-read.ts](../../lib/db-read.ts) exists as prepared infrastructure. `DATABASE_READ_URL` env var is **unset in practice today**; when unset, the client falls back to the writer URL ([lib/db-read.ts:20](../../lib/db-read.ts#L20)) — collapsing reader and writer into one endpoint. No application route currently imports `prismaRead` for production reader-routed queries.
- **Application-layer "replication":** Upstash Redis cache, populated lazily via `cachedWithStaleness`. Invalidation delete-only after mutations (27 sites). Not a replication protocol — a derived read cache that only reflects successful DB reads (BSRS Ch 8 P2c lazy-populate).
- **Cross-system async "replication":** Stripe → our DB via webhooks. Stripe is the leader; our DB is a follower; `ProcessedWebhookEvent` + `releaseWebhookEvent` give effectively-once convergence.
- **Connection pool:** `max: 5, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 10_000` on both writer and reader clients ([lib/db.ts:28-32](../../lib/db.ts#L28-L32), [lib/db-read.ts:13-17](../../lib/db-read.ts#L13-L17)). Shipped in `c4a796b` Fix 3.
- **What we do NOT run:** multi-leader Postgres (Bucardo, pglogical multi-directional), leaderless (Cassandra / Dynamo), application-layer replication (writing to two stores from the app).

The Ch 5 lens on this composition: Aurora gives us strong single-leader storage replication for free at the AZ level; the application's only replication concerns are (a) when to route reads to the unused reader endpoint, (b) keeping the Redis cache honest across writes, and (c) handling Stripe → DB asymmetric replication correctly.

---

## 1. Leaders and Followers (DDIA §5.1)

DDIA §5.1 classifies replication topologies. BenefitsSafe fits the **single-leader** model at every scale:

- **At the storage layer (Aurora):** one writer; 6-way storage replication across 3 AZs; failover promotes a replica to writer (operator-invisible for < ~30s typical Aurora failover).
- **At the application layer:** every mutation hits the one Aurora writer. No app-level multi-writer. No sharding.
- **At the deploy layer:** BSRS Ch 8 P3 runs two Vercel deployments (canary + stable) behind a Cloudflare router Worker. **Both share the same Aurora writer by design** — see [bsrs-ch08-p3-design.md](./bsrs-ch08-p3-design.md) §5. The two channels differ only in the Postgres ROLE they connect as (`bs_canary` vs `bs_stable`, per BSRS Ch 8 P3a), not in which writer they talk to.

**Why single-leader:** BenefitsSafe is a money system. Every write is linearizable on the writer (cross-reference [`ddia-ch09-consistency-consensus-applied.md`](./ddia-ch09-consistency-consensus-applied.md) §3). Single-leader trades write-availability during failover (briefly CP) for linearizability. The trade is right for this product.

**The forward-looking invariant:** if a future PDR ever introduces a second Aurora writer (multi-region active-active for disaster recovery, or a truly independent canary writer), §1 of this doc would need rewriting. The claims in every doc across the DDIA series (Ch 5 §1, Ch 8 §6.1, Ch 9 §3, Ch 11 §2, Ch 12 §3) rest on shared-writer. Any PDR changing that must propagate through all five.

---

## 2. Synchronous vs Asynchronous Replication (DDIA §5.1)

DDIA §5.1 distinguishes synchronous replication (leader waits for follower ack before acking client) from asynchronous (leader acks immediately, follower catches up). BenefitsSafe has both patterns, applied at different layers:

| Layer | Protocol | Sync / Async | Durability guarantee |
|---|---|---|---|
| Aurora storage replication | 6-way quorum writes across 3 AZs | **Synchronous** (4/6 copies) | Commit is durable before the writer returns success to Prisma |
| Aurora writer → reader endpoint | Log streaming | **Asynchronous** (by default) | Reader can be seconds behind; not used in production today (§4) |
| App → Redis cache | Lazy-populate on read; delete-on-write | **Asynchronous, delete-only** | Cache can be stale; staleness is bounded by `maxStaleSeconds`; invalidation failure = bounded staleness, not state divergence (cross-ref [`ddia-ch11-stream-processing-applied.md`](./ddia-ch11-stream-processing-applied.md) §3.1) |
| Stripe → our DB | Webhook HTTP with retry up to 3 days | **Asynchronous, at-least-once + idempotent dedup = effectively-once** | `ProcessedWebhookEvent @id` on external event id |
| Our DB → Better Stack logs + Sentry errors | Fire-and-forget HTTP | **Asynchronous, fail-open** | Observability outage must not affect requests |
| Our DB → QStash job payloads | HMAC-verified HTTP | **Asynchronous, at-least-once + messageId dedup** | Jobs converge regardless of retry |

**Ch 5 observation:** application-layer "replication" to Redis and observability sinks is not replication in the Kleppmann sense — it's a derived view fed from the DB commit stream. The distinction matters because the "dual-write trap" (DDIA §11.3) only applies when the app writes to both stores; our delete-only invalidation pattern avoids it (cross-ref [`ddia-ch11-stream-processing-applied.md`](./ddia-ch11-stream-processing-applied.md) §3.1).

---

## 3. Setting Up New Followers / Handling Node Outages (DDIA §5.1)

DDIA §5.1 "Setting Up New Followers" + "Handling Node Outages": the hard parts of single-leader are (a) bootstrapping a new follower without blocking the leader, (b) failing over when the leader dies.

### 3.1 Aurora handles both — operator-invisible

**Aurora-managed operations** we don't implement at the app layer:
- New storage-replica bootstrap (AWS handles via its distributed storage layer; the app doesn't see it).
- Writer failover (Aurora promotes a read replica; typical promotion < 30s).
- Read-replica provisioning (one-click in AWS console; operator decision).
- WAL archival + PITR (automatic, retention-period configurable).

### 3.2 Application-layer failover concessions — shipped in `c4a796b` Fix 3

**Connection pool sizing** is the app's concession to Aurora failover:

```ts
// lib/db.ts:28-32 + lib/db-read.ts:13-17
const POOL_CONFIG = {
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
} as const;
```

Three Ch 5 § "Handling Node Outages" concerns addressed:

- **`connectionTimeoutMillis: 10_000`** — without it, a pool-acquire during a failover would wait until TCP timeout (minutes). The 10s bound converts "unbounded failover wait" into `DbUnavailableError` + `Retry-After` in a deterministic window. Cross-reference [`ddia-ch08-distributed-systems-applied.md`](./ddia-ch08-distributed-systems-applied.md) §3.2.
- **`idleTimeoutMillis: 30_000`** — Lambda freeze/thaw keeps idle sockets around; after thaw the TCP connection may be dead-but-not-yet-detected. Recycling at 30s ensures a warm Lambda doesn't hold a broken connection across a failover.
- **`max: 5` per-Lambda ceiling** — prevents 10K connections across 1K warm Lambdas (the old default was 10/Lambda). At 200 warm × 5 = 1000, fits behind RDS Proxy (or Aurora's ~1000 `max_connections`) even at peak.

### 3.3 Degraded-mode serving during failover

When Aurora is unavailable, BSRS Ch 8 P2 absorbs the outage at the application layer:

- **Writes:** `assertDbHealthy()` gate at [lib/db-health.ts:161-166](../../lib/db-health.ts#L161-L166) throws `DbUnavailableError`; route returns 503 + `Retry-After`.
- **Reads:** `cachedWithStaleness` at [lib/cache.ts:86-150](../../lib/cache.ts#L86-L150) serves stale cache up to `maxStaleSeconds`; if no cache exists, returns `{kind: "unavailable"}`.
- **Client-side banner:** `useDegradedMode` polls `/api/health` every 30s; within ~60s of failover, every user sees the degraded signal.

Cross-reference [`bsrs-ch08-resilience-applied.md`](./bsrs-ch08-resilience-applied.md) §P2 scorecard row and [`ddia-ch08-distributed-systems-applied.md`](./ddia-ch08-distributed-systems-applied.md) §2 for the layered-detection mechanics.

**Ch 5 framing:** the app doesn't have to *do* failover — Aurora does. The app's job is to (a) fail fast when the current writer is unreachable, (b) serve degraded reads from a derived cache, (c) tell the user what's happening. All three are shipped.

---

## 4. Replication Lag and DATABASE_READ_URL (DDIA §5.2)

DDIA §5.2 "Problems with Replication Lag" opens the chapter's most important section: once you add a read replica, eventual consistency between writer and reader creates three anomaly classes (read-your-writes, monotonic reads, consistent prefix reads).

### 4.1 Current state — the reader is prepared but unused

[lib/db-read.ts](../../lib/db-read.ts) exists:

```ts
// Reader pool uses the same sizing as the writer — see lib/db.ts for
// rationale. When DATABASE_READ_URL is unset this falls back to the
// writer URL, which means a cold start talks to the writer until the
// reader endpoint is configured in Vercel. (DDIA Ch5 Replication audit.)
function createReadClient(): PrismaClient {
  const readUrl = process.env.DATABASE_READ_URL || process.env.DATABASE_URL;
  ...
}
```

When `DATABASE_READ_URL` is unset (current production state), the reader client talks to the writer — lag is zero because there's only one endpoint. The infrastructure exists; the flag-flip is deferred.

### 4.2 Why it's deferred

- **Current scale doesn't need reader routing.** Reports, analytics, and dashboard reads run adequately on the writer.
- **Routing reports to the reader requires replica-lag SLO.** DDIA §5.2's three anomaly classes become real once the reader diverges from the writer. None of §5–§7 below matter today; all three mitigations get activated by flipping the flag.
- **Money paths MUST stay on the writer.** Even when `DATABASE_READ_URL` is enabled, balance checks, grant lookups, and any read feeding a subsequent write must never hit the reader (linearizability violation — cross-ref [`ddia-ch09-consistency-consensus-applied.md`](./ddia-ch09-consistency-consensus-applied.md) §2.3 for the per-path classification this would require).

### 4.3 Trigger to turn it on

Cataloged as F1 below. Signal: reporting-query latency on the writer regresses AND affects OLTP p95 on other paths. Not today.

---

## 5. Problems with Replication Lag — Read-Your-Writes (DDIA §5.2)

DDIA §5.2 "Reading your own writes": a user who just made a mutation expects to see their change on the next read. Replication lag breaks this: the mutation landed on the writer but the read hit a follower that hasn't caught up.

### 5.1 Current application-layer mitigation — cache invalidation

Even with `DATABASE_READ_URL` unset, the Redis cache is a read replica of sorts. If a write succeeds and the cache isn't invalidated, the next read serves stale data — the same read-your-writes anomaly at the cache layer rather than the DB layer.

**`c4a796b` Fix 4** wired `invalidateDashboardCache(organizationId)` into every write path. Today 27 call sites across `app/api/`:
- Grant create/update → `invalidateCacheByPrefix(CACHE_KEYS.orgGrants(orgId))` + `invalidateDashboardCache(orgId)`.
- Expense approve / reject / submit → `invalidateDashboardCache(orgId)`.
- Vendor create → `invalidateCacheByPrefix(CACHE_KEYS.orgVendors(orgId))` + `invalidateDashboardCache(orgId)`.
- Beneficiary create / update → `invalidateDashboardCache(orgId)`.
- Stripe webhook handlers (issuing-settlement, billing, charges) → `invalidateDashboardCache(affectedOrg)`.
- 22 more call sites.

### 5.2 Why this works under Redis-delete semantics

The invalidation is **delete-only**, not write-through. Sequence:

1. Client submits mutation.
2. `$transaction` commits to Aurora.
3. `invalidateCacheByPrefix(...)` deletes any cached view for the affected org.
4. Response returned to client.
5. Client's next read misses the cache, falls through to Aurora, repopulates fresh.

If step 3 fails (Redis down): next reader sees stale cache until `maxStaleSeconds` expires — **bounded staleness**, not state divergence. This is the difference between a cache-invalidation pattern and a write-through pattern; the former tolerates partial failure, the latter creates the DDIA §11.3 dual-write trap. Cross-reference [`ddia-ch11-stream-processing-applied.md`](./ddia-ch11-stream-processing-applied.md) §3.1 for the full analysis.

### 5.3 When `DATABASE_READ_URL` is enabled — what changes

If/when the reader flag flips, read-your-writes becomes a DB-layer concern too:

- A user who just created a grant can't safely read it from the reader (might not have replicated yet).
- Candidate mitigations: (a) route all reads for a user who mutated in the last N seconds back to the writer (session-sticky read routing); (b) use read-after-write tokens (client sends a timestamp with their read, server routes to whichever endpoint is caught up); (c) restrict reader routing to paths that don't need read-your-writes (analytics, historical reports).

Today this design conversation is deferred — see F1 below.

---

## 6. Problems with Replication Lag — Monotonic Reads (DDIA §5.2)

DDIA §5.2 "Monotonic reads": a user who sees a row at version N must never then see an older version < N. Replication lag breaks this when the user's first request hits a fast replica and the second hits a slow one.

### 6.1 Current mitigation — single writer, uniform reads

Today every read hits the writer, so monotonic reads are trivially preserved: you can't see a version older than what you last saw because the writer has them all.

### 6.2 `bs_channel` cookie stickiness — mostly aspirational today

The Cloudflare router Worker at [cloudflare/workers/benefitssafe-router.js](../../cloudflare/workers/benefitssafe-router.js) sets a 24-hour `bs_channel=canary|stable` cookie on first request. Subsequent requests from the same browser stick to the same channel.

**Current value:** both channels share one Aurora writer (BSRS Ch 8 P3 design), so channel stickiness doesn't yet serve a monotonic-reads purpose — it just keeps the user on the same deployment (code version) for UI consistency.

**Future value (conditional):** if canary and stable ever route to different Aurora read replicas (which they don't today, by design), `bs_channel` would become the monotonic-reads mechanism — each user sees one replica per 24h, never crossing between replicas mid-session.

### 6.3 What would break monotonic reads today

Three hypothetical scenarios, all catalogued as future-state (F3, F4):

- If `DATABASE_READ_URL` is enabled AND reads are split round-robin across multiple reader endpoints.
- If the canary and stable channels ever diverge on which reader they use.
- If the cache TTL varies per-user across Redis shards (not applicable today — Upstash is one logical instance).

None apply at commit `daea13c`. The mitigations are designed but not ship-blocking.

---

## 7. Problems with Replication Lag — Consistent Prefix Reads (DDIA §5.2)

DDIA §5.2 "Consistent prefix reads": causally-related writes must be seen in causal order. If partition A replicates faster than partition B and you read both, you can see an effect before its cause.

### 7.1 Free from single-writer + commit-time ordering

A single writer commits in a total order (cross-reference [`ddia-ch09-consistency-consensus-applied.md`](./ddia-ch09-consistency-consensus-applied.md) §3). When every read hits the writer, there is no way to observe an out-of-order prefix. Consistent prefix reads is a **free property** of our current single-writer-single-reader topology.

### 7.2 When it would become real

Only with partitioning or multi-leader:

- **Partitioning:** if `LedgerEntry` is ever partitioned by `organizationId` across separate Postgres servers with independent replication lag (F5 in [`ddia-ch12-future-data-systems-applied.md`](./ddia-ch12-future-data-systems-applied.md) §9.C), an observer reading two partitions could see an out-of-order prefix. Mitigation: route reads for the same user to the same partition (trivially satisfied by `organizationId`-based routing).
- **Multi-leader:** if two Aurora writers exist in different regions, writes to one region can cross-replicate to the other out of order relative to a user's writes. Not applicable today (§9 below).

Today single-writer + single-reader gives us consistent prefix reads for free. No code.

---

## 8. Webhook Idempotency as Asymmetric Inter-System Replication (DDIA §5.1 tangent)

DDIA §5.1 describes replication between nodes of one database. BenefitsSafe has an analogous relationship at a different granularity: **Stripe → our DB is inter-system replication.** Stripe is the leader for card authorizations, card transactions, disputes, billing state; our DB is a follower that catches up via webhook delivery.

### 8.1 At-least-once + idempotency = effectively-once

[lib/webhook-idempotency.ts:29-67](../../lib/webhook-idempotency.ts#L29-L67):

```ts
export async function markWebhookProcessed(
  eventId: string,
  webhookType: WebhookType,
): Promise<IdempotencyResult> {
  try {
    await prisma.processedWebhookEvent.create({
      data: { id: eventId, webhookType },
    });
    return { firstTime: true };
  } catch (err) {
    if ((err as { code: string }).code === "P2002") {
      return { firstTime: false };
    }
    throw err;
  }
}
```

Keyed on the external event id (`ProcessedWebhookEvent.id @id` at [prisma/schema.prisma:1019](../../prisma/schema.prisma#L1019)). The Ch 5 framing: this is "keeping replicas in sync via idempotent delivery." The row's existence proves we've processed the event; the unique-id constraint converts at-least-once delivery into effectively-once application.

### 8.2 The `releaseWebhookEvent` contract — `c4a796b` Fix 2

[lib/webhook-idempotency.ts:70-84](../../lib/webhook-idempotency.ts#L70-L84):

```ts
export async function releaseWebhookEvent(eventId: string): Promise<void> {
  try {
    await prisma.processedWebhookEvent.delete({ where: { id: eventId } });
  } catch {
    // Row may have been purged or never existed. Nothing we can do.
  }
}
```

**The problem `c4a796b` Fix 2 solved:** the idempotency row is committed independently from the processing tx (by design — we want retries to re-run after processing failures). If a handler writes the row, then throws during processing, and the outer route returns 500 without releasing the row: Stripe retries → row exists → `deduped: true` returned → event permanently lost.

Pre-`c4a796b` bug sites:
- **`stripe-charges`:** outer catch returned 200 on DB failure → Stripe saw success → never retried → card charges permanently lost. **Fintech data-loss path.**
- **`stripe-billing`:** returned 500 but never released → retries hit `deduped: true` → subscription state could drift out of sync with Stripe.
- **`stripe` main:** 3 dispute handler catches silently returned 200 → dispute events silently dropped.

All three fixed. Handlers now track `processedEventId` across the try block and call `releaseWebhookEvent(processedEventId)` in the outer catch before returning 500. Stripe's retry (up to 3 days) re-enters processing with a fresh chance to succeed.

### 8.3 Residual hard-kill exposure

Cross-referenced in [`ddia-ch08-distributed-systems-applied.md`](./ddia-ch08-distributed-systems-applied.md) §5.3 and [`ddia-ch09-consistency-consensus-applied.md`](./ddia-ch09-consistency-consensus-applied.md) §7 P5: a Lambda hard-kill (maxDuration / OOM) bypasses the `finally` block, leaving the row unreleased. Narrow window; Stripe's 3-day retry covers it for narrow exposures but not for structural hard-kill rates. Not re-proposed here.

### 8.4 Ch 5 vs Ch 11 framings of the same primitive

Both applied docs cite `ProcessedWebhookEvent`. The Ch 5 framing: inter-system replication with idempotent dedup. The Ch 11 framing: at-least-once delivery + effectively-once processing via idempotent consumer. Different framings, same code — neither doc duplicates the other, each names the pattern from its chapter's perspective.

---

## 9. Multi-Leader Replication (DDIA §5.3) — NOT USED

DDIA §5.3 describes multi-leader replication: two or more writers accept writes independently and asynchronously propagate to each other. Used for multi-region active-active, offline-first clients (CouchDB-style), collaborative editing.

**BenefitsSafe does not use multi-leader.** Two reasons:

1. **Conflict resolution is expensive for money.** Active-active writers can accept conflicting debits on the same grant; last-write-wins is unacceptable; app-level merge logic is complex. Single-leader with brief write-unavailability during failover is the simpler correct answer.
2. **No product driver today.** We don't have offline-first clients, geographically-split writers, or collaborative-editing features. Every mutation is a transactional write on behalf of one authenticated user in one org — cleanly single-leader.

**Trigger for reconsideration:** regulatory / enterprise customer RPO/RTO requirements that can't be met by Aurora's single-region failover alone. At that point the PDR would need to propagate through every Ch 5/8/9/11/12 doc (see §1.2 forward-looking invariant). Not close today.

---

## 10. Leaderless Replication (DDIA §5.4) — NOT USED

DDIA §5.4 describes leaderless replication: every node accepts reads and writes; quorum-based dedup. Used by Dynamo, Cassandra, Riak.

**BenefitsSafe does not use leaderless.** One reason:

1. **Aurora provides quorum transparently at the storage layer.** The 6-way synchronous replication across 3 AZs IS a quorum write (4/6 ack for durability). We get the fault-tolerance benefits of leaderless replication without having to run Dynamo / Cassandra / Riak at the app layer. The application sees one logical writer and lets AWS handle the storage-layer quorum math.

**Trigger for reconsideration:** none foreseen. The Dynamo / Cassandra ergonomics — weak consistency by default, client-side conflict resolution, read repair — are strictly worse than Aurora's strong-by-default model for a money system.

---

## 11. Open Issues and Action Items

Three-way split: **ALREADY-FIXED** (document, don't re-propose), **CURRENT-STATE** (name what exists), **FUTURE-STATE** (deferred with triggers).

### 11.A ALREADY-FIXED (from `c4a796b` + Ch 5-adjacent infrastructure)

| A# | Item | DDIA § | Commit | Anchor |
|---|---|---|---|---|
| **A1** | Cross-org platform-admin bypass collapse — 6 sites now scope unconditionally to `session.user.organizationId` | §5.2 Cross-org isolation under replication lag (SOC 2 incident-grade) | `c4a796b` Fix 1 | [app/api/expenses/route.ts](../../app/api/expenses/route.ts), [app/api/audit-logs/route.ts](../../app/api/audit-logs/route.ts), [lib/data/index.ts](../../lib/data/index.ts) (4 fetchers) |
| **A2** | Webhook event-loss fix — `releaseWebhookEvent` contract honored across all 3 Stripe webhook routes + dispute handlers rethrow | §5.1 Follower recovery from transient leader unavailability | `c4a796b` Fix 2 | [app/api/webhooks/stripe/route.ts](../../app/api/webhooks/stripe/route.ts), [app/api/webhooks/stripe-billing/route.ts](../../app/api/webhooks/stripe-billing/route.ts), [app/api/webhooks/stripe-charges/route.ts](../../app/api/webhooks/stripe-charges/route.ts) |
| **A3** | Connection pool sizing (`max:5, idleTimeoutMillis:30_000, connectionTimeoutMillis:10_000`) on both writer and reader clients | §5.1 Handling node outages — fast-fail during Aurora failover | `c4a796b` Fix 3 | [lib/db.ts:28-32](../../lib/db.ts#L28-L32), [lib/db-read.ts:13-17](../../lib/db-read.ts#L13-L17) |
| **A4** | Dashboard cache invalidation wired into grants/expenses/beneficiaries/vendors write paths + 3 webhook handlers (27 sites total today) | §5.2 Read-your-writes mitigation at the cache layer | `c4a796b` Fix 4 | 7 files + per-case affected-org return in `stripe-billing` |
| **A5** | `ProcessedWebhookEvent` + `markWebhookProcessed` + `releaseWebhookEvent` — the core asymmetric-replication dedup primitive | §5.1 Inter-system replication with at-least-once + idempotency | pre-`c4a796b` foundational; `c4a796b` closed the release-contract bug | [lib/webhook-idempotency.ts](../../lib/webhook-idempotency.ts) + [prisma/schema.prisma:1018-1024](../../prisma/schema.prisma#L1018-L1024) |
| **A6** | Additional cross-org query fixes — 9 more queries across 5 files | §5.2 Isolation (extended) | Ch 12 `74cf1f0` | cross-ref [`ddia-ch12-future-data-systems-applied.md`](./ddia-ch12-future-data-systems-applied.md) §9.A A1 |
| **A7** | Prisma org-scoping client extension — 27 org-scoped models, Phase 1 shadow mode | §5.2 Runtime defense against future cross-org regressions | subsequent | cross-ref [`ddia-ch12-future-data-systems-applied.md`](./ddia-ch12-future-data-systems-applied.md) §9.A A7 |

### 11.B CURRENT-STATE (document, no code change)

| C# | Item | DDIA § | Anchor |
|---|---|---|---|
| **C1** | Aurora single-leader topology — writer + 6-way synchronous storage replication across 3 AZs + PITR | §5.1 Leaders and followers | §0 + §1 |
| **C2** | `DATABASE_READ_URL` unused today; `lib/db-read.ts` is prepared infrastructure with writer-fallback | §5.2 Replication lag not yet in scope | [lib/db-read.ts:20](../../lib/db-read.ts#L20); §4 |
| **C3** | BSRS Ch 8 P3 shared-writer invariant across canary + stable channels — different ROLE, same writer | §5.1 Single-leader preserved under P3 traffic split | cross-ref [bsrs-ch08-p3-design.md](./bsrs-ch08-p3-design.md) §5; §1 |
| **C4** | `cachedWithStaleness` as bounded-staleness derived-view replication, not a dual-write | §5.2 Read-path replication lag | cross-ref [`ddia-ch11-stream-processing-applied.md`](./ddia-ch11-stream-processing-applied.md) §3.1 + [`ddia-ch12-future-data-systems-applied.md`](./ddia-ch12-future-data-systems-applied.md) §5 |
| **C5** | `bs_channel` cookie stickiness keeps a user on one channel per 24h — currently for UI consistency; becomes load-bearing for monotonic reads only if channels ever split on reader endpoint | §5.2 Monotonic reads (conditional) | [cloudflare/workers/benefitssafe-router.js](../../cloudflare/workers/benefitssafe-router.js); §6 |
| **C6** | Consistent-prefix-reads comes for free from single-writer commit ordering | §5.2 Consistent prefix reads | §7 |
| **C7** | Multi-leader replication NOT USED — rationale documented (money-conflict cost, no product driver) | §5.3 Multi-leader | §9 |
| **C8** | Leaderless replication NOT USED — rationale documented (Aurora storage-layer quorum is sufficient) | §5.4 Leaderless | §10 |
| **C9** | Stripe → our DB as asymmetric inter-system replication; at-least-once + `ProcessedWebhookEvent` idempotency = effectively-once | §5.1 Asymmetric replication (tangent) | §8 |

### 11.C FUTURE-STATE (deferred with triggers)

Every item is **don't build now**. Each row states the signal under which the decision flips.

| F# | Item | DDIA § | Trigger |
|---|---|---|---|
| **F1** | Turn on `DATABASE_READ_URL` for a subset of reports-read routes | §5.2 Accepting replica lag | Reporting-query latency on the writer regresses AND affects OLTP p95 on other paths. Scope: non-financial reports only; money paths stay on writer. |
| **F2** | Surface replica lag as a first-class contract (analogous to `_meta.staleness` for cache) | §5.2 Replica-lag SLO | F1 ships AND a user-facing "why is my data stale" signal becomes product-relevant |
| **F3** | Cross-channel replica-awareness for monotonic reads (if canary + stable ever route to different reader endpoints) | §5.2 Monotonic reads under split-reader | F1 ships AND the BSRS Ch 8 P3 design is revised to split replicas per channel |
| **F4** | Active-active multi-region Aurora | §5.3 Multi-leader | Regulatory or enterprise customer RPO/RTO requirements that Aurora's single-region failover can't meet. Today: not close. Would require propagating shared-writer invariant revisions through Ch 5/8/9/11/12 docs. |
| **F5** | Formalize a replica-lag SLO | §5.2 | F1 + F2 both ship and we need an operational metric |

---

## 12. What this audit establishes

DDIA Chapter 5 discipline is applied correctly in BenefitsSafe:

- **Single-leader is a deliberate choice** — shipped across storage, app, and deploy layers (§1). Forward-looking invariant flagged.
- **Sync vs async is picked per layer** — Aurora storage is sync; app → Redis is async-delete-only; Stripe → our DB is async at-least-once + idempotent dedup (§2).
- **Failover is Aurora-managed; the app's concession is pool sizing + degraded mode** (§3). `c4a796b` Fix 3 closed the pool-exhaustion + unbounded-failover-wait hazards.
- **Replica lag is not currently in scope** — `DATABASE_READ_URL` is unset; `lib/db-read.ts` is prepared infrastructure; F1 is the trigger condition (§4).
- **Read-your-writes is solved at the cache layer** via delete-only invalidation across 27 write sites (`c4a796b` Fix 4). The delete-only policy specifically avoids the DDIA §11.3 dual-write trap (§5).
- **Monotonic reads is trivially preserved today** by single-reader; `bs_channel` cookie is prepared for when it isn't (§6).
- **Consistent prefix reads comes free** from single-writer commit ordering (§7).
- **Webhook idempotency is asymmetric inter-system replication** — `c4a796b` Fix 2 closed three fintech-data-loss paths (§8).
- **Multi-leader and leaderless are intentionally avoided** — one paragraph each explaining why, with named triggers for reconsideration (§§9–10).

The remaining work is the `DATABASE_READ_URL` design conversation (F1) and a speculative multi-region path (F4). Both are trigger-gated; neither is on the critical path.

---

## 13. Cross-chapter ties

- **DDIA Ch 7 (Transactions):** §3.2 connection pool sizing is shared with Ch 7's single-writer assumption. `$transaction` Serializable sites run on the writer; the reader (when enabled) will NOT be suitable for money tx.
- **DDIA Ch 8 (Distributed Systems):** Fix 3 connection pool is jointly a Ch 5 + Ch 8 concern. §3.2 here names the Ch 5 angle (failover), [`ddia-ch08-distributed-systems-applied.md`](./ddia-ch08-distributed-systems-applied.md) §3.2 names the Ch 8 angle (unbounded delay prevention).
- **DDIA Ch 9 (Consistency and Consensus):** §1 single-leader claim is what makes Ch 9 §3 total-order-broadcast possible. Cross-reference [`ddia-ch09-consistency-consensus-applied.md`](./ddia-ch09-consistency-consensus-applied.md) §3.
- **DDIA Ch 11 (Stream Processing):** §8 webhook idempotency is also Ch 11's effectively-once delivery primitive. Cross-reference [`ddia-ch11-stream-processing-applied.md`](./ddia-ch11-stream-processing-applied.md) §1.3.
- **DDIA Ch 12 (Future of Data Systems):** §5.1 cache invalidation dual-write bounded-staleness analysis is grounded in the Ch 12 §3.1 framing. Cross-reference [`ddia-ch12-future-data-systems-applied.md`](./ddia-ch12-future-data-systems-applied.md) §3.1 + §5.
- **BSRS Ch 8 (Design for Resilience):** §3.3 degraded-mode serving during Aurora failover is BSRS Ch 8 P2. Cross-reference [`bsrs-ch08-resilience-applied.md`](./bsrs-ch08-resilience-applied.md) §P2.

---

## 14. Open questions for a future session

- **When does `DATABASE_READ_URL` turn on?** F1 trigger is "reporting-query latency regresses AND affects OLTP p95." Operational monitoring on writer p99 + reporting-query latency will surface this. Which routes qualify? Initial candidates: `/api/reports/grants`, `/api/reports/expenses`, `/api/analytics/*` — all non-financial. Needs explicit per-route classification before the flag flips.
- **How to surface replica lag if F1 ships?** Candidate: extend `_meta.staleness` envelope to reads against the replica, with `{kind: "replica", lagSeconds}`. Needs product-side review.
- **Does the `bs_channel` cookie ever become load-bearing?** Only if BSRS Ch 8 P3 is revised to give canary and stable different reader endpoints. Today both channels share one writer and one reader (even though the reader isn't actively used). The P3 design doc would need an explicit decision before this changes.
- **Multi-region active-active is speculative.** If an enterprise contract ever requires RPO ≤ 0 across regions, the Ch 5 assumptions in every applied doc break. A hypothetical dual-writer PDR would need to propagate through Ch 5/8/9/11/12 in one atomic revision.
- **`ProcessedWebhookEvent` retention.** Unbounded growth. At 1.8M orgs × N Stripe events/month, eventual index-scan latency concern. Stripe's retry window is 72h — rows older than ~1 week are safe to archive. Tracked as Phase 2B work in [`CHAPTER_12_AUDIT_SESSION.md`](../../CHAPTER_12_AUDIT_SESSION.md).

---

## References

- Kleppmann, *Designing Data-Intensive Applications*, 1st ed., O'Reilly 2017. Chapter 5.
- Prior Ch 5 audit commit: `c4a796b`.
- AWS Aurora storage replication docs: [https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/Aurora.Overview.StorageReliability.html](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/Aurora.Overview.StorageReliability.html).
- DDIA Ch 7 applied doc: [`ddia-ch07-transactions-applied.md`](./ddia-ch07-transactions-applied.md).
- DDIA Ch 8 applied doc: [`ddia-ch08-distributed-systems-applied.md`](./ddia-ch08-distributed-systems-applied.md).
- DDIA Ch 9 applied doc: [`ddia-ch09-consistency-consensus-applied.md`](./ddia-ch09-consistency-consensus-applied.md).
- DDIA Ch 11 applied doc: [`ddia-ch11-stream-processing-applied.md`](./ddia-ch11-stream-processing-applied.md).
- DDIA Ch 12 applied doc: [`ddia-ch12-future-data-systems-applied.md`](./ddia-ch12-future-data-systems-applied.md).
- BSRS Ch 8 applied doc: [`bsrs-ch08-resilience-applied.md`](./bsrs-ch08-resilience-applied.md).
- BSRS Ch 8 P3 design: [`bsrs-ch08-p3-design.md`](./bsrs-ch08-p3-design.md).
- Writer client + pool config: [`../../lib/db.ts`](../../lib/db.ts).
- Reader client + pool config: [`../../lib/db-read.ts`](../../lib/db-read.ts).
- Webhook idempotency helper: [`../../lib/webhook-idempotency.ts`](../../lib/webhook-idempotency.ts).
- Cache invalidation helpers: [`../../lib/cache.ts`](../../lib/cache.ts).
- Cloudflare router Worker: [`../../cloudflare/workers/benefitssafe-router.js`](../../cloudflare/workers/benefitssafe-router.js).

---

*Generated 2026-04-19 during BenefitsSafe security-hardening session. Verified against commit `daea13c`. Scorecard mirrors Ch 7 / Ch 8 / Ch 9 / Ch 11 / Ch 12 format for cross-doc consistency.*

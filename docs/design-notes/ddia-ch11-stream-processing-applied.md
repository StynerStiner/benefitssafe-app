# DDIA Chapter 11 (Stream Processing) Applied to BenefitsSafe

**Reference:** Kleppmann, *Designing Data-Intensive Applications* (1st ed.), Chapter 11, pp. 439–514.

**Scope:** Map every Ch 11 concept — messaging systems, partitioned logs, databases-as-streams, event sourcing, processing streams (CEP, materialized views, time, joins, fault tolerance) — onto BenefitsSafe's current patterns. **This is not a proposal to adopt Kafka.** BenefitsSafe already applies most of Ch 11's discipline *without* a dedicated stream-processing framework, and at pre-launch scale with a solo developer, adding one would be infrastructure for infrastructure's sake. The doc's job is to name the existing patterns, catalog the prior Ch 11 findings that shipped piecemeal, and mark what's future-state with explicit trigger conditions.

**Audit date:** 2026-04-19
**Codebase commit at audit time:** `1a85c88`
**Prior Ch 11 findings that already shipped (no dedicated commit header, landed inside broader commits):**
- Event-time windowing via DB clock in `card-expiration` Pass 2 — [app/api/cron/card-expiration/route.ts:248-295](../../app/api/cron/card-expiration/route.ts#L248-L295).
- AuditLog PII redaction (preserves event fact, scrubs PII values) — [app/api/admin/data-deletion/route.ts:3-28](../../app/api/admin/data-deletion/route.ts#L3-L28).
- `Document.archivedAt` soft-delete column so audit facts survive deletion — [scripts/add-document-archived-at.ts:1-26](../../scripts/add-document-archived-at.ts#L1-L26).

Companion to [`ddia-ch07-transactions-applied.md`](./ddia-ch07-transactions-applied.md) (single-node isolation), [`ddia-ch09-consistency-consensus-applied.md`](./ddia-ch09-consistency-consensus-applied.md) (linearizability + ordering), and [`bsrs-ch08-resilience-applied.md`](./bsrs-ch08-resilience-applied.md) (failure handling + CAP/PACELC).

---

## 0. Stack baseline

- **External event producers:** Stripe (three webhook endpoints — `/api/webhooks/stripe` for Issuing JIT + transaction settlement + disputes + Connect account updates, `/api/webhooks/stripe-billing` for our own subscription billing, `/api/webhooks/stripe-charges` for Issuing charge events).
- **Internal message broker:** Upstash QStash. Five job types under `app/api/jobs/` — `check-thresholds`, `run-compliance`, `generate-report`, `process-charge`, `send-notification`. EdDSA HMAC verification via `Receiver.verify()` at [lib/queue/index.ts:117-135](../../lib/queue/index.ts#L117-L135); per-message idempotency via `claimJobMessage` Redis SET NX on `Upstash-Message-Id`.
- **Canonical commit log:** Aurora PostgreSQL writer. Every state change is a commit; the commit stream IS our total order broadcast (see [ddia-ch09-consistency-consensus-applied.md](./ddia-ch09-consistency-consensus-applied.md) §3).
- **Append-only event tables:** `LedgerEntry`, `AuditLog`, `ProcessedWebhookEvent` — all three are DB-privilege enforced as immutable via `REVOKE UPDATE, DELETE` at [scripts/db/create-aurora-roles.sql:102-104](../../scripts/db/create-aurora-roles.sql#L102-L104) (BSRS Ch 8 P3a).
- **Derived read cache:** Upstash Redis with channel-prefixed keys. Lazy-populate during Aurora degraded mode (BSRS Ch 8 P2c `cachedWithStaleness`), TTL-bounded staleness surfaced via `_meta.staleness`.
- **Consumer offsets for batch dispatchers:** `CronCheckpoint` table ([lib/cron-checkpoint.ts](../../lib/cron-checkpoint.ts)) persists the last processed cursor per cron so a paginated sweep over 1.8M orgs resumes between invocations.
- **What we do NOT run:** Kafka, Kinesis, Redpanda, Pulsar, Flink, Debezium, Samza, Spark Streaming. No partitioned logs. No stream-processing framework. No dedicated event bus between internal services because we don't have internal services — the monolith is the only consumer of every event stream.

This matters because every claim below is conditioned on "the database is the event log" and "QStash + HTTP is the only message transport."

---

## 1. Transmitting Event Streams (DDIA §11.1)

DDIA §11.1 catalogs three transports: direct messaging (producer calls consumer), message brokers (durable intermediary), and log-based brokers (Kafka-style). Each has different ack/redelivery semantics.

### 1.1 Stripe as a durable message broker

Every Stripe webhook is an external event delivered to `/api/webhooks/stripe[-billing|-charges]`. Stripe's retry contract (DDIA §11.1 "Acknowledgments and redelivery"):

- Any non-2xx response schedules a retry.
- Retries continue for up to 72 hours with exponential backoff.
- Deliveries are **at-least-once** — a handler must assume any event may be redelivered.

Our consumer pattern at the top of [app/api/webhooks/stripe/route.ts:47-113](../../app/api/webhooks/stripe/route.ts#L47-L113):

1. **Signature verification** before any side effect (rejects anything that isn't Stripe).
2. **Dedup by event id** via `markWebhookProcessed(event.id, "stripe")` at [lib/webhook-idempotency.ts:29-67](../../lib/webhook-idempotency.ts#L29-L67) — Prisma insert; P2002 unique violation = duplicate, return 200 + `{deduped: true}`.
3. **Processing dispatch** via switch on `event.type`.
4. **On thrown error** the outer try/catch calls `releaseWebhookEvent` so Stripe's next retry re-enters processing (cross-reference [ddia-ch09-consistency-consensus-applied.md](./ddia-ch09-consistency-consensus-applied.md) §7 P5 for the residual hard-kill exposure — not re-catalogued here).

**Exception — Issuing JIT.** `issuing_authorization.request` explicitly skips the dedup table ([app/api/webhooks/stripe/route.ts:101-113](../../app/api/webhooks/stripe/route.ts#L101-L113)). Stripe needs a fresh approve/decline within 2 seconds on every retry, and the handler is idempotent by construction (re-reads card + grant balance on every call). Event-level dedup would break the 2s deadline.

### 1.2 QStash as internal broker

QStash is Upstash's serverless HTTP message queue. Producers call `enqueueJob(path, payload)` at [lib/queue/index.ts:39-92](../../lib/queue/index.ts#L39-L92); QStash delivers via HTTP POST to the target URL with an EdDSA signature. Our consumer pattern:

1. `verifyJobAuth(request)` checks the HMAC + returns the `Upstash-Message-Id`.
2. `claimJobMessage(messageId)` Redis SET NX dedup with 48-hour TTL (longer than QStash's retry window).
3. Business logic.
4. 2xx to ack; non-2xx triggers QStash retry (default 3×).

Dispatcher → QStash → per-entity job is our only fan-out pattern. [app/api/cron/sentinel/route.ts:53-60](../../app/api/cron/sentinel/route.ts#L53-L60) fan-outs one `/api/jobs/check-thresholds` per org; [app/api/cron/compliance/route.ts](../../app/api/cron/compliance/route.ts) fan-outs `/api/jobs/run-compliance`; etc.

**Delivery model:** QStash is point-to-point (load-balancing-style per DDIA §11.1) — one consumer URL per message. We do not use QStash's fan-out-to-multiple-URLs because there's only one consumer per event type. If that changes (F2 below), the choice of transport should be revisited.

### 1.3 Effectively-once delivery

At-least-once delivery from the broker + idempotency at the consumer = effectively-once processing. Every handler enforces idempotency via at least one of:

- **Event-id unique insert** (`ProcessedWebhookEvent.id @id`).
- **Message-id Redis SET NX** (`claimJobMessage` at [lib/queue/index.ts:169-185](../../lib/queue/index.ts#L169-L185)).
- **Natural-key lookup** (`LedgerEntry.reference = transaction.id` at [app/api/webhooks/stripe/route.ts:494-497](../../app/api/webhooks/stripe/route.ts#L494-L497)).
- **Stripe idempotency key** on card creation (`card-exp-${expense.id}-${mode}` at [app/api/expenses/[id]/issue-card/route.ts:519](../../app/api/expenses/%5Bid%5D/issue-card/route.ts#L519)).
- **DB unique constraint** catching concurrent duplicates (20 `@unique` / `@@unique` declarations in `prisma/schema.prisma`).

**Status:** SAFE. This is the DDIA Ch 11 recipe applied consistently across all event consumers.

---

## 2. Partitioned Logs (DDIA §11.2)

DDIA §11.2 is mostly about Kafka-style log-based message brokers where the log itself is partitioned across machines and consumers track their position by offset. **BenefitsSafe does not have a partitioned log.** Aurora is one writer; there is no Kafka.

What we have that's analogous:

### 2.1 Aurora commit stream as a single-partition log

Every mutation on Aurora produces a commit in WAL. That WAL is, effectively, our event log — single-partition (one writer), totally ordered by commit time, durable for the life of the PITR retention window. We don't expose it externally (no Debezium → Kafka), but inside the same DB process the commit stream IS the total order broadcast (see [ddia-ch09-consistency-consensus-applied.md](./ddia-ch09-consistency-consensus-applied.md) §3).

If BSRS Ch 8 P3b ever introduces a second writer for disaster-recovery active-active, THIS section's "one partition" claim breaks and Ch 11's partitioning concerns become real. No such plan today.

### 2.2 `CronCheckpoint` as a consumer-offset table

DDIA §11.2 "Consumer offsets" describes the pattern: a broker doesn't track what each consumer has read; the consumer persists its own offset. Our batch dispatchers use exactly this pattern, reimplemented against Aurora:

```ts
// lib/cron-checkpoint.ts
export async function readCheckpoint(cronName: string): Promise<string | null> { ... }
export async function writeCheckpoint(cronName: string, lastCursor: string | null, processedCount: number): Promise<void> { ... }
```

The `CronCheckpoint` table at [prisma/schema.prisma:874-880](../../prisma/schema.prisma#L874) stores `cronName @unique` + `lastCursor`. Consumers: `sentinel-dispatcher`, `compliance-dispatcher`, `reports-dispatcher`, `card-expiration-expire`, `card-expiration-notify`, `check-unanswered`. Each reads its offset at the top of a firing, advances through a batch, writes the new offset at the bottom.

This is DDIA's consumer-offset pattern applied to a Postgres-backed dispatcher rather than a Kafka topic. The cursor is `Organization.id` (`sentinel`, `compliance`, `reports`) or `VirtualCard.id` (`card-expiration`) or `Conversation.id` (`check-unanswered`) — the primary key of whatever table is being swept.

### 2.3 Replay

DDIA §11.2 highlights replay-ability as a key advantage of log-based brokers. Our replay story is **bounded-time-period**, not **offset-addressed**:

- [app/api/cron/reconciliation/route.ts:54-203](../../app/api/cron/reconciliation/route.ts#L54) re-scans the prior month's Stripe `issuing.transactions.list` and diffs against `LedgerEntry` rows in the same window. This IS a replay of the event stream, bounded to a month.
- `LedgerEntry` is immutable + indexed by `(grantId, createdAt)` + `(organizationId, createdAt)` — in principle, arbitrary time-window replay is cheap.
- We cannot say "replay from offset X" because we don't have offsets; we can say "replay from timestamp T" within Aurora's PITR window.

**Scope limit:** a non-bounded replay (from beginning of time) would require re-scanning every LedgerEntry across every org. At pre-launch scale that's ~zero rows; at 1.9M-org projected scale it's a data-pipeline job, not a cron. Future-state only if the trigger (F5 below) fires.

---

## 3. Databases and Streams (DDIA §11.3)

DDIA §11.3 argues that keeping two systems in sync (a DB and a cache, a DB and a search index, a DB and an OLAP warehouse) is the central problem that streams solve. If you do it by "dual write" (write both from the app), you're racing two systems with different failure modes. If you do it by CDC (single DB write, stream-derive everything else), you get a single source of truth with ordered propagation.

### 3.1 Dual-write analysis — cache invalidation

BenefitsSafe has one dual-write pattern: **after every mutation, best-effort purge the affected Redis keys.** 27 call sites; the gold-standard example is [app/api/vendors/route.ts:386-388](../../app/api/vendors/route.ts#L386-L388):

```ts
// $transaction already committed by this point
await invalidateCacheByPrefix(CACHE_KEYS.orgVendors(organizationId));
await invalidateDashboardCache(organizationId);
```

The classic DDIA §11.3 "dual-write trap" (writer crashes between write A and write B → systems diverge) is BOUNDED in our case because **both writes are delete-only on the secondary** — we don't write fresh data to Redis after a mutation, we delete the stale key. Failure modes:

| Failure | Effect |
|---|---|
| `$transaction` fails → invalidation skipped | Correct. Nothing changed in Aurora; nothing to invalidate. |
| `$transaction` succeeds, invalidation fails (Redis down) | Redis serves stale data until TTL expires. Bounded staleness, not divergent state. Eventually self-heals. |
| `$transaction` succeeds, invalidation partial (only some keys) | Some cached views fresh, others stale. Bounded by the stalest key's TTL. |
| Concurrent reader repopulates stale data between the tx commit and the invalidation delete | The reader sees the *new* post-commit DB state (reads hit Aurora, not Redis, per `cachedWithStaleness` lazy-populate policy at [lib/cache.ts:86-120](../../lib/cache.ts#L86-L120)). SAFE. |

**Why we don't have the classical dual-write trap:** BSRS Ch 8 P2c's lazy-populate design means `cachedWithStaleness` only populates Redis from a fresh DB fetch at read time, never from an app write. So cache entries are always a projection of a DB read that already succeeded — there is no state Redis holds that Aurora doesn't. Invalidation can silently fail and the worst case is "reader sees the pre-write view until TTL elapses"; it cannot produce a cache entry that never existed in Aurora.

**Status:** SAFE. Document as an architectural invariant so a future PR that adds "cache write on mutation" (instead of "cache delete on mutation") knows it would be introducing the DDIA dual-write trap for the first time.

### 3.2 Change Data Capture — not used today

DDIA §11.3 "Change Data Capture" describes Debezium-style extraction of DB change events into a derived system (search index, OLAP store, etc.). BenefitsSafe does not run CDC. There is no Debezium, no logical replication slot, no derived system fed from Aurora's WAL.

**When it would pay off:** when BenefitsSafe has a second system that needs a consistent, ordered view of DB changes (not a cache — a *projection*). Candidate triggers are in §9 F1 (full-text search index) and F6 (analytics warehouse).

### 3.3 Event sourcing — `LedgerEntry` and `AuditLog` as event logs

DDIA §11.3 "Event Sourcing" distinguishes state mutation ("update balance = 500") from event sourcing ("append charge event for $50; current balance is a projection"). BenefitsSafe has both, picked per-table:

| Table | Model | Immutability | Projection |
|---|---|---|---|
| `LedgerEntry` ([prisma/schema.prisma:565-585](../../prisma/schema.prisma#L565)) | **Event-sourced.** Every money movement is an immutable row with `type: CREDIT/DEBIT`, `amount`, `balanceAfter`, `reference`. | DB-level `REVOKE UPDATE, DELETE` at [scripts/db/create-aurora-roles.sql:102](../../scripts/db/create-aurora-roles.sql#L102). | `Grant.remainingAmount` / `Grant.spentAmount` / `BudgetCategory.spentAmount` — all maintained atomically inside the settlement/approval `$transaction` that inserts the LedgerEntry (see §4.2 below). |
| `AuditLog` ([prisma/schema.prisma:614-631](../../prisma/schema.prisma#L614)) | **Event log.** Every data mutation creates an AuditLog row with `action`, `entityType`, `entityId`, `oldValue`/`newValue` JSON. | DB-level `REVOKE UPDATE, DELETE` at [scripts/db/create-aurora-roles.sql:103](../../scripts/db/create-aurora-roles.sql#L103). | None — audit is read by humans / compliance tools, not projected into app state. |
| `ProcessedWebhookEvent` ([prisma/schema.prisma:1018-1024](../../prisma/schema.prisma#L1018)) | **Dedup log.** Event IDs we've already processed. | DB-level `REVOKE UPDATE, DELETE` at [scripts/db/create-aurora-roles.sql:104](../../scripts/db/create-aurora-roles.sql#L104). | None — it's the consumer-state table for the webhook stream processor. |
| `Organization`, `User`, `Grant` (metadata), `Expense.status`, `VirtualCard.status`, `BillingSubscription.*` | **Mutable state.** Current row = current truth. | None (fully mutable). | AuditLog IS the indirect event log — every mutation emits an AuditLog row documenting oldValue → newValue. |

**Two key observations:**

1. **`Grant.remainingAmount` is a hybrid.** It's a mutable-state column on Grant, but its updates are constrained to happen atomically with a LedgerEntry insert inside the same `$transaction`. That means the materialized projection cannot drift from the event log (they commit or roll back together). Classical event sourcing would derive balance at read time by summing LedgerEntry rows; we pay a small write-time cost (one UPDATE) to avoid that read-time cost. It's event sourcing with an eagerly-materialized projection. Cross-reference [ddia-ch07-transactions-applied.md](./ddia-ch07-transactions-applied.md) §1 "Consistency" for the invariant enforcement.

2. **The immutability advantage is DB-enforced.** DDIA §11.3 "The Immutability Advantage" argues that making event tables truly append-only means a buggy route or compromised instance cannot rewrite history. Most systems enforce this by *convention*. BSRS Ch 8 P3a moved it into the DB grant model — bs_stable and bs_canary have `SELECT, INSERT` but NOT `UPDATE, DELETE` on the three event tables. A runtime role cannot rewrite or delete these rows no matter what bug or compromise occurs. Migrations that need to evolve the schema use the `bs_migrator` role, operator-held. This is the strongest formulation of "immutability advantage" the chapter discusses.

### 3.4 Deriving multiple views from one log

DDIA §11.3 "Deriving several views from the same event log" says an event log lets you derive multiple read-optimized views. At BenefitsSafe scale we don't need multiple derived stores, but we do maintain multiple derived projections from the LedgerEntry + AuditLog streams:

- `Grant.remainingAmount` — fast balance read for enforcement decisions (JIT authorization, approval paths).
- `Grant.spentAmount` — fast cumulative-spend read for reporting.
- `BudgetCategory.spentAmount` — per-category budget roll-up.
- `UsageCounter` ([lib/usage-tracker.ts:48-63](../../lib/usage-tracker.ts#L48)) — platform-level usage metrics per org.
- `Organization.subscriptionStatus` — derived from `BillingSubscription.status` changes (another materialized projection, maintained by webhook handlers).

All five are in-Aurora projections maintained synchronously inside the same tx as the source event. There's no derived store (Redis, OpenSearch, BigQuery) fed from the log today.

---

## 4. Processing Streams (DDIA §11.4)

DDIA §11.4 lists uses of stream processing: (a) complex event processing, (b) stream analytics, (c) maintaining materialized views, (d) search indexes, (e) messaging / notifications.

### 4.1 Complex event processing — SentinelLayer

DDIA §11.4 "Complex event processing" (CEP) describes rule-based pattern matching over event streams. Rules fire when a condition holds and emit a derived event.

BenefitsSafe's SentinelLayer is a lightweight CEP:

- **Dispatcher:** [app/api/cron/sentinel/route.ts](../../app/api/cron/sentinel/route.ts) — daily cursor-paginated sweep that enqueues one QStash job per org.
- **Per-org evaluator:** [app/api/jobs/check-thresholds/route.ts](../../app/api/jobs/check-thresholds/route.ts) — reads the org's beneficiaries + grants + billing state and evaluates rules.

Rules today (at [app/api/jobs/check-thresholds/route.ts:70-102](../../app/api/jobs/check-thresholds/route.ts#L70-L102)):

| Rule | CEP formulation |
|---|---|
| Grant balance < 20% | WHEN `spentAmount / totalAmount > 0.85` THEN emit `sentinel_alert{entityId: "${grant.id}:low"}` |
| Grant end within 30 days | WHEN `endDate - now() ≤ 30d` THEN emit `sentinel_alert{entityId: "${grant.id}:expiring"}` |

**Dedup window:** per-warning tumbling day — the evaluator checks if a `sentinel_alert` with the same `entityId` was already created today, and skips if so ([app/api/jobs/check-thresholds/route.ts:104-119](../../app/api/jobs/check-thresholds/route.ts#L104-L119)). Admins see each alert at most once per 24 hours. Correct window semantics: tumbling (non-overlapping) day windows.

**Classification:** this is CEP in the DDIA sense — event-driven rule evaluation with emitted derived events (Notification rows) and windowed dedup. It runs as a scheduled batch rather than a continuous stream, but the pattern is the same.

### 4.2 Materialized views

Each projection listed in §3.4 above is a materialized view in DDIA §11.4 sense — a query result kept up-to-date as the underlying events change.

**Write path for `Grant.remainingAmount` settlement** ([app/api/webhooks/stripe/route.ts:518-574](../../app/api/webhooks/stripe/route.ts#L518-L574)):

1. `SELECT FOR UPDATE` the Grant row (row lock).
2. `UPDATE Grant SET spentAmount = spentAmount + :amount, remainingAmount = remainingAmount - :amount` (+ `allowNegativeBalance` flag on overspend branch).
3. `INSERT INTO LedgerEntry (..., balanceAfter: updatedGrant.remainingAmount, reference: transaction.id)`.
4. All three inside `prisma.$transaction` → atomic commit or rollback together.

The projection update AND the event insert are in the same commit. Any reader — whether they query the projection or sum the event log — sees a consistent view as of some commit. Cross-reference [ddia-ch07-transactions-applied.md](./ddia-ch07-transactions-applied.md) §1 "Consistency" and §6 "Serializability."

**Approval path for `Grant.remainingAmount` debit** uses the same pattern with explicit Serializable isolation — cross-reference [ddia-ch07-transactions-applied.md](./ddia-ch07-transactions-applied.md) §2 gold-standard site at `app/api/expenses/[id]/approve/route.ts:101`.

### 4.3 Search indexes

None today. No OpenSearch, no Typesense, no Postgres full-text GIN index fed from change events. `Document.title` search uses `LIKE '%query%'` against Aurora, which is adequate at current scale. Future-state F1 below.

### 4.4 Messaging / notifications as a stream

`Notification` rows are the output of multiple upstream streams:
- SentinelLayer → `sentinel_alert` notifications.
- `stripe` webhook → `grant_overspent` notifications ([app/api/webhooks/stripe/route.ts:580-599](../../app/api/webhooks/stripe/route.ts#L580-L599)) + `dispute_created` notifications ([app/api/webhooks/stripe/route.ts:812-824](../../app/api/webhooks/stripe/route.ts#L812-L824)).
- `card-expiration` cron → `card_expiring_soon` and `card_expired` notifications.
- `check-unanswered` cron → `unanswered_warning` + `unanswered_urgent` escalations.
- `reconciliation` cron → `reconciliation_discrepancy` notifications to platform admins.

The `Notification` table is the fan-out point. Email fan-out happens alongside (via `sendEmail` from `lib/services/email-service.ts`). Both are fire-and-forget relative to the triggering tx — DDIA §11.4 "notifications and stream processing" pattern.

### 4.5 Better Stack logs vs the audit log

**These are different streams.** Better Stack receives debug + observability logs (structured via `lib/logger.ts`, tagged with `deploy_channel` per BSRS Ch 8 P3c). It's a firehose for human operators debugging live production behavior.

The audit log (`AuditLog` table) is the compliance event log — every user-driven mutation. It is NOT shipped to Better Stack, and Better Stack logs are NOT an audit trail for compliance. Conflating these would weaken both (Better Stack has log retention limits; AuditLog has DB-enforced immutability that Better Stack doesn't). Document as two orthogonal streams with different guarantees and different readers.

---

## 5. Time Reasoning (DDIA §11.4 "Reasoning About Time")

DDIA §11.4 "Reasoning About Time" distinguishes **event time** (when the event actually happened, per the producer's clock) from **processing time** (when the consumer got around to processing it). Choosing the wrong one introduces subtle bugs under retries, backlogs, and clock skew.

### 5.1 Event-time guards that shipped

**Stripe billing via `event.created`** (strongest form — the producer's own clock). [app/api/webhooks/stripe-billing/route.ts](../../app/api/webhooks/stripe-billing/route.ts) every handler passes `new Date(event.created * 1000)` into a `lastBillingEventAt`-gated `updateMany`. A late retry of an older event finds `lastBillingEventAt` already advanced past its `eventAt`, returns `count=0`, and the handler logs a no-op warning. Shipped in Ch 9 `06e0cd9`. See [ddia-ch09-consistency-consensus-applied.md](./ddia-ch09-consistency-consensus-applied.md) §4.1.

**`card-expiration` Pass 2 via DB clock (`NOW()`).** [app/api/cron/card-expiration/route.ts:248-295](../../app/api/cron/card-expiration/route.ts#L248-L295). The pre-Ch 11 implementation used `new Date()` on the Lambda (processing-time semantics) as both bounds of the 7-day "expires soon" notification window. Processing-time means: if the cron ran late for any reason (platform outage, bad deploy, pause), cards whose expiry fell inside the lag window would silently miss the notification. The fix switched to `NOW()` inside the raw SQL so the comparison happens on the DB clock — the same clock that wrote `expiresAt` in the first place. No cross-clock drift. Per-card dedup via the existing `card_expiring_soon` Notification row check makes re-scans idempotent.

**Why DB clock here and producer clock there:** `card-expiration`'s source of truth is `VirtualCard.expiresAt`, a DB column written by our own write path. The DB clock is the authoritative event-time for that field. Stripe billing's source of truth is `event.created` from Stripe's systems — Stripe's clock is the authoritative event-time for those. The rule: use the producer's clock for events that crossed a system boundary, the DB clock for events rooted in DB state.

### 5.2 Remaining processing-time uses — audit

A survey of cron window-bound expressions:

| Cron | Window bound | Clock | Classification |
|---|---|---|---|
| `card-expiration` Pass 1 (expire) | `expiresAt <= now` where `now = new Date()` on Lambda | Processing-time (Lambda clock) | **Defensible.** This pass expires cards whose `expiresAt` has already passed, and idempotency on `status = EXPIRED` makes re-scans harmless. Drift between Lambda clock and DB clock is within NTP bounds (a few hundred ms at worst) — well below the daily expiry boundary's granularity. |
| `card-expiration` Pass 2 (notify) | `NOW() > expiresAt` and `expiresAt <= NOW() + INTERVAL '7 days'` | Event-time (DB clock) | SAFE. The Ch 11 fix. |
| `check-unanswered` | `createdAt >= twentyFourHoursAgo` where `twentyFourHoursAgo = new Date(now - 24h)` | Processing-time (Lambda clock) | **Defensible.** `createdAt` is set by the Lambda insert path at roughly the same clock source. The window is an "escalate at approximately 24h" signal, not a strict SLA — dedup via existing `unanswered_warning` Notification row check means re-runs are idempotent even under clock drift. |
| `reconciliation` | `createdAt: { gte: lastMonth, lt: thisMonth }` | Processing-time (Lambda clock) | **Defensible.** Monthly boundary with coarse granularity; a few seconds of clock drift is insignificant. Stripe side uses `created: { gte: lastMonthUnix, lt: thisMonthUnix }` — also Lambda clock. |
| `revoke-expired-grants` | `expiresAt: { lt: now }` where `now = new Date()` | Processing-time (Lambda clock) | **Defensible.** Enforcement does NOT depend on this cron (α + β gates check `expiresAt` at request time per [app/api/cron/revoke-expired-grants/route.ts:1-11](../../app/api/cron/revoke-expired-grants/route.ts#L1-L11)); the cron only backfills `revokedAt` for historical record. Clock drift can cause at most a few seconds of timestamp imprecision on the audit log — cosmetic. |
| SentinelLayer `check-thresholds` | `createdAt >= startOfToday` where `startOfToday = new Date(); setHours(0,0,0,0)` | Processing-time (Lambda-local-midnight) | **Defensible for the dedup window.** Per-warning dedup gate means re-evaluation within the same day won't double-alert. Lambda runs in UTC on Vercel so "today" is deterministic across invocations of the same day. |

No outstanding processing-time bugs. The `card-expiration` Pass 2 fix was the one case where lag could cause silent missed events; it's fixed. Every other cron's use of processing-time is either idempotent-under-skew or serves a coarse-granularity purpose where sub-second drift doesn't matter.

---

## 6. Stream Joins (DDIA §11.4 "Stream Joins")

DDIA §11.4 classifies three join types:
- **Stream-stream:** two live streams, windowed overlap (e.g. click + impression).
- **Stream-table:** live stream enriched with the current state of a slow-changing reference table.
- **Table-table:** two materialized views of long-lived state kept in sync.

### 6.1 Stream-table — `handleTransactionCreated`

[app/api/webhooks/stripe/route.ts:470-574](../../app/api/webhooks/stripe/route.ts#L470). Incoming Stripe transaction event (stream) is enriched with VirtualCard → ExpenseRequest → Grant state (tables):

```ts
const virtualCard = await prisma.virtualCard.findUnique({
  where: { stripeCardId },
  select: {
    id: true,
    organizationId: true,
    expense: { select: { grantId: true, categoryId: true } },
  },
});
```

Join key: `stripeCardId` (Stripe's side of the event) ↔ `VirtualCard.stripeCardId` (our side). One DB lookup per event. The joined-in state is the Grant row under a `SELECT FOR UPDATE` (see §4.2), which gives the join serializability against concurrent settlements.

### 6.2 Stream-table ordering-guarded — `handleSubscriptionUpdated`

[app/api/webhooks/stripe-billing/route.ts](../../app/api/webhooks/stripe-billing/route.ts) `handleSubscriptionUpdated`. Incoming `customer.subscription.updated` event (stream) is enriched with the existing `BillingSubscription` row (table). Join key: `sub.id` ↔ `BillingSubscription.stripeSubscriptionId`. The join itself is a normal stream-table enrichment; the interesting part is the **ordering guard** on the subsequent UPDATE — `lastBillingEventAt < :eventAt`. This prevents a late-arriving stream event from overwriting a more-recent table row. Cross-reference [ddia-ch09-consistency-consensus-applied.md](./ddia-ch09-consistency-consensus-applied.md) §4.1.

### 6.3 Periodic bounded-snapshot join — `reconciliation`

[app/api/cron/reconciliation/route.ts:89-203](../../app/api/cron/reconciliation/route.ts#L89). This is NOT a live stream-stream join. It's a periodic (monthly) comparison of two snapshots:
- Stripe `issuing.transactions.list` for the prior month (bounded period from Stripe).
- `LedgerEntry` + `Transaction` rows for the same month (bounded period from Aurora).

The cron walks Stripe's list, looks up each transaction by `stripeTransactionId` in our DB, flags discrepancies (`MISSING_TRANSACTION`, `AMOUNT_MISMATCH`), and then walks our `LedgerEntry` DEBITs and verifies each `reference` exists in Stripe (`ORPHANED_LEDGER_ENTRY`). Both directions are join + diff.

**Why this shape instead of a live stream-stream join:** Stripe doesn't give us an always-on event stream; they give us webhooks (stream of state changes) + a REST list API (snapshot). Our `LedgerEntry` is a stream (immutable append), but for reconciliation we only need a monthly point-in-time diff. Live diffing would add infrastructure without adding product value — we have 7 days to dispute any Stripe charge, so monthly catches anything that matters. Future-state F7 below if that changes.

### 6.4 What we don't do

**Real-time stream-stream joins** (e.g. watching all incoming Stripe events against all outgoing QStash jobs within a window) are absent. We don't need them: our event rates don't warrant that, and our join keys are strong enough (Stripe IDs, Upstash message IDs) that coincident-in-time detection isn't interesting.

---

## 7. Fault Tolerance (DDIA §11.4 "Fault Tolerance")

DDIA §11.4 "Fault Tolerance" describes approaches: microbatching, atomic commit, idempotence, rebuilding state from logs.

- **Microbatching:** not used. We process one event per handler invocation. At current scale this is fine; Lambda cold-start + Aurora per-event tx are not the bottleneck.
- **Atomic commit across systems:** not done. No 2PC, no XA — cross-reference [ddia-ch09-consistency-consensus-applied.md](./ddia-ch09-consistency-consensus-applied.md) §5.1.
- **Idempotence:** the primary fault-tolerance tool. Cross-reference §1.3 above — effectively-once delivery via at-least-once + idempotency.
- **Rebuilding state from logs:** possible in principle (`LedgerEntry` is immutable and indexed) but not operationally exercised today. Reconciliation cron is a narrow form. Full state rebuild is a future-state capability (F5).

**Saga with compensation** (not explicitly a Ch 11 concept but in DDIA §11.4 territory): the Stripe × Aurora write path uses Pre-create-Stripe → DB write → compensate-on-failure. Orphan-sweep cron is the "compensation of last resort." Cross-reference [ddia-ch09-consistency-consensus-applied.md](./ddia-ch09-consistency-consensus-applied.md) §5.2.

---

## 8. Immutability and PII (DDIA §11.3 "Immutability Advantage" ∩ CCPA/GDPR)

DDIA §11.3 "The Immutability Advantage" argues that immutable event logs are strictly easier to reason about, debug, and recover from than mutable-state tables. BenefitsSafe leans on this — §3.3 lists three append-only tables with DB-privilege enforcement.

But **CCPA and GDPR require deletion of user PII on request**, and our event tables contain PII inside `AuditLog.oldValue` / `newValue` JSON blobs. The tension is structural: immutability and right-to-erasure are incompatible invariants if PII lives inside the immutable rows.

### 8.1 The pattern that shipped

[app/api/admin/data-deletion/route.ts](../../app/api/admin/data-deletion/route.ts) resolves the tension by **preserving the event fact, scrubbing the PII values**:

- The AuditLog row is NOT deleted (preserves: action, actor, timestamp, organizationId, entityType, entityId — the compliance signals).
- Top-level PII keys inside `oldValue` / `newValue` (known list: `email`, `name`, `firstName`, `lastName`, `phone`, `ssn`, `dob`, `address`, `beneficiary`, `cardholderName`, `bankAccount`, …) are replaced with the literal string `"[REDACTED]"`.
- The entire mutation runs in a single `$transaction` (CCPA requires all-or-nothing on deletion requests).

This is the DDIA Ch 11 "immutability advantage" pattern adapted to a regulatory constraint. The event log still proves that an event of type X happened at time T by user Y against entity Z; the PII that described the entity at that point in time is gone.

### 8.2 Soft-delete as a supplement

Hard-deleting a `Document` row would lose the audit fact that the document ever existed. [scripts/add-document-archived-at.ts:1-26](../../scripts/add-document-archived-at.ts#L1-L26) adds a nullable `Document.archivedAt` so deletions soft-delete — row stays (preserves audit traceability), `archivedAt IS NOT NULL` hides it from active queries. Same pattern applies to user deletions at the application layer (anonymize, don't drop).

### 8.3 Cross-table PII sweep — current limits

The redaction pass walks AuditLog but does NOT walk Notification `message`, `title`, or other event-adjacent tables that could embed PII. An audit (not executed here, future work) should enumerate every JSON / text column that could embed PII from user-driven writes and extend the redaction accordingly. Track under F3-extended when the trigger fires.

---

## 9. Open Issues and Action Items

Separated into **CURRENT-STATE** (document / already shipped) and **FUTURE-STATE** (deferred with explicit trigger).

### CURRENT-STATE — document what exists

| C# | Item | DDIA § | File:line | Action |
|---|---|---|---|---|
| **C1** | Event-time windowing via DB clock in `card-expiration` Pass 2 | §11.4 Time reasoning | [app/api/cron/card-expiration/route.ts:248-295](../../app/api/cron/card-expiration/route.ts#L248-L295) | Shipped. Documented in §5.1 above as the Ch 11 processing-time → event-time fix pattern. |
| **C2** | `lastBillingEventAt` event-time guard using producer clock | §11.4 Time reasoning | [app/api/webhooks/stripe-billing/route.ts](../../app/api/webhooks/stripe-billing/route.ts) (handlers at :272, :358, :441, :478, :560) | Shipped in `06e0cd9`. Cross-referenced to [ddia-ch09-consistency-consensus-applied.md](./ddia-ch09-consistency-consensus-applied.md) §4.1. |
| **C3** | DB-privilege-enforced immutability on `LedgerEntry`, `AuditLog`, `ProcessedWebhookEvent` | §11.3 Immutability Advantage | [scripts/db/create-aurora-roles.sql:102-104](../../scripts/db/create-aurora-roles.sql#L102-L104) + [prisma/schema.prisma:565, :614, :1018](../../prisma/schema.prisma#L565) | Shipped in BSRS Ch 8 P3a `f32442f`. Documented in §3.3 above as the strongest form of the "immutability advantage." |
| **C4** | Cache invalidation analyzed as a bounded-staleness dual-write (NOT a state-divergence dual-write) | §11.3 Keeping systems in sync | [lib/cache.ts:44-65](../../lib/cache.ts#L44-L65) + 27 invalidation sites across `app/api/` | Documented in §3.1 above. Invariant to preserve: do not introduce cache *writes* after mutations; stay with delete-only invalidation so the trap described in DDIA §11.3 stays non-applicable. |
| **C5** | SentinelLayer as CEP with tumbling-day dedup window | §11.4 Complex event processing | [app/api/cron/sentinel/route.ts](../../app/api/cron/sentinel/route.ts) dispatcher + [app/api/jobs/check-thresholds/route.ts:70-119](../../app/api/jobs/check-thresholds/route.ts#L70-L119) per-org evaluator + dedup | Documented in §4.1 above. |
| **C6** | `CronCheckpoint` as consumer-offset table for batch dispatchers | §11.2 Consumer offsets | [lib/cron-checkpoint.ts](../../lib/cron-checkpoint.ts) + [prisma/schema.prisma:874-880](../../prisma/schema.prisma#L874) | Documented in §2.2 above. |
| **C7** | Materialized projections of the ledger event stream, maintained atomically inside the settlement/approval tx | §11.4 Materialized views | `Grant.remainingAmount`, `Grant.spentAmount`, `BudgetCategory.spentAmount`, `UsageCounter`, `Organization.subscriptionStatus` | Documented in §3.3 / §4.2 above. Invariant: any new projection MUST be updated inside the same `$transaction` as the source event, or it will drift. |
| **C8** | AuditLog PII redaction preserves the event fact, scrubs only the PII values | §11.3 Immutability ∩ CCPA | [app/api/admin/data-deletion/route.ts](../../app/api/admin/data-deletion/route.ts) | Documented in §8 above as the canonical CCPA/GDPR answer for BenefitsSafe. |
| **C9** | Effectively-once delivery via at-least-once + idempotency applied consistently | §11.1 Ack & redelivery + cross-ref Ch 9 §4.1 | [lib/webhook-idempotency.ts](../../lib/webhook-idempotency.ts), [lib/queue/index.ts:169-185](../../lib/queue/index.ts#L169-L185), `LedgerEntry.reference` natural-key dedup, Stripe idempotency keys, 20 `@unique` / `@@unique` constraints | Documented in §1.3 above. Cross-reference to [ddia-ch09-consistency-consensus-applied.md](./ddia-ch09-consistency-consensus-applied.md) §4.1. |
| **C10** | Fix Ch 9 doc mislabel "BSRS Ch 11" → proper DDIA Ch 11 framing with cross-reference to this doc | docs-only | [docs/design-notes/ddia-ch09-consistency-consensus-applied.md:158](./ddia-ch09-consistency-consensus-applied.md#L158) | Bundled into the commit that creates this Ch 11 doc. |

### FUTURE-STATE — deferred with explicit trigger

Every item here is **don't build this yet**. Each row names the signal that would change that answer.

| F# | Item | DDIA § | Trigger condition | Why not now |
|---|---|---|---|---|
| **F1** | CDC from Aurora → derived full-text search index (OpenSearch / Typesense / pg-tsvector GIN) | §11.3 Change Data Capture | Document full-text search becomes a product requirement AND `LIKE '%query%'` latency regresses past acceptable threshold on production data. | At current scale `LIKE` is cheap. CDC infrastructure is not. |
| **F2** | Dedicated event bus (Kafka / Kinesis / Redpanda) for internal fan-out | §11.1 Messaging systems | ≥ 2 internal consumers need the *same* event stream. Today the monolith is the only consumer of every stream. | QStash's point-to-point HTTP model is sufficient. Event bus = operational complexity we don't currently need. |
| **F3** | Extend event-sourcing discipline to Expense state machine | §11.3 Event sourcing | Audit / compliance reviewers can't answer "reconstruct the full approval path for this expense" from `AuditLog.oldValue/newValue` alone. | Today `AuditLog` covers it. Every Expense status transition writes an AuditLog row. |
| **F4** | Microbatching webhook processing | §11.4 Fault tolerance | Stripe webhook throughput saturates single-Lambda-per-event capacity (signals: QStash queue depth alerts from Better Stack, p99 webhook ingestion latency > 10s sustained). | Current rates are 2-3 orders of magnitude below saturation. |
| **F5** | Full time-travel replay of LedgerEntry for retroactive rule application | §11.3 Event sourcing — replay | A new compliance rule needs to be applied retroactively to past transactions (e.g., recategorize historical MCCs, apply a new overspend policy backdated 3 months). | Reconciliation cron's bounded-monthly replay is sufficient for anomaly detection. Full replay is speculative. |
| **F6** | Analytics warehouse fed from Aurora CDC (per-org usage metrics, cohort analysis, funnel reports) | §11.4 Stream analytics | BI / product analytics become a real need (likely after significant paying traffic). Today Sentry + Better Stack + ad-hoc DB queries cover operational analytics. | Premature at pre-launch / solo-developer scale. |
| **F7** | Near-real-time reconciliation — windowed stream join of Stripe webhooks vs LedgerEntry | §11.4 Stream joins | Dispute incidents where the monthly reconciliation cadence is the bottleneck (e.g. fraud detected mid-month that the cron wouldn't catch until month-end). | Current 7-day Stripe dispute window + monthly reconciliation is adequate. |
| **F8** | Partition `LedgerEntry` by `(organizationId, seq)` or by time | Cross-ref Ch 9 P2 (monotonic seq) + §11.2 partitioning | Ch 9 P2 ships first (adds the seq column) AND per-org query latency regresses on LedgerEntry scan at scale. Pre-partitioning without the seq column is premature. | Waiting on Ch 9 P2 + a concrete latency signal. |

---

## 10. What this audit establishes

BenefitsSafe already applies DDIA Chapter 11 stream-processing discipline *without* running a stream-processing framework:

- **Event-time windowing** where retries can legitimately reorder things (C1 DB clock, C2 producer clock).
- **Idempotency** everywhere at-least-once delivery could otherwise double-apply (C9).
- **Immutable append-only event logs** for the three tables where history matters, enforced at the DB privilege boundary (C3).
- **Materialized projections** of the ledger event stream maintained atomically in the same tx as the source event (C7).
- **Consumer offsets** for batch dispatchers against Aurora (C6).
- **CEP-style rule evaluation** with windowed dedup (C5).
- **Bounded-staleness dual-write** that provably can't drift into divergent state (C4).
- **Immutability-vs-CCPA tension resolved** by preserving the event fact and scrubbing the PII values (C8).

The chapter's discipline comes from the stack composition (Aurora + Stripe + QStash + Redis) rather than from Kafka. Adding Kafka would not make any of the above patterns *more* correct; it would just add operational surface. Every future-state item has a trigger condition, and at pre-launch / solo-developer / not-yet-at-100K-orgs scale none of the triggers have fired.

**This is an applied reading, not a call to build infrastructure.**

---

## 11. Cross-chapter ties

- **DDIA Ch 5 (Replication):** webhook idempotency + `releaseWebhookEvent` on failure were Ch 5 fixes. `ProcessedWebhookEvent` table is the shared artifact.
- **DDIA Ch 7 (Transactions):** every materialized projection update happens inside a `$transaction` with its source-event insert. Ch 7's Serializable + FOR UPDATE is what makes §4.2's atomicity claim true.
- **DDIA Ch 8 (Distributed Systems):** circuit breaker, Lambda-per-instance state, fail-fast timeouts are the substrate every stream processor here sits on.
- **DDIA Ch 9 (Consistency and Consensus):** event-time ordering on `stripe-billing` (§4.1 of that doc) is what §5.1 here points at. Remaining ordering gaps on `handleDisputeUpdated` / `handleAccountUpdated` are catalogued there (Ch 9 P1, P3), not duplicated here.
- **DDIA Ch 12 (Future of Data Systems):** cross-org isolation work in `74cf1f0` is adjacent — it's the structural invariant that every event here carries a correct `organizationId`.
- **BSRS Ch 5 (Least Privilege):** §5 P4 "AuditLog immutability" design-note option (c) proposed external-log-store shipping; the option we landed on — DB-privilege `REVOKE UPDATE, DELETE` — is documented in this doc's §3.3 / §8 as the Ch 11 "immutability advantage" in its strongest form.
- **BSRS Ch 8 P2c (Stale-cache reads):** the architectural reason §3.1's dual-write stays "bounded staleness" instead of "divergent state" is that `cachedWithStaleness` is lazy-populate — cache only reflects a DB read that already succeeded.
- **BSRS Ch 8 P3a (Aurora role separation):** the REVOKE UPDATE/DELETE invariant in §3.3 is shipped by P3a; §8's PII redaction pattern is what makes that REVOKE compatible with CCPA.

---

## 12. Open questions for a future session

- **When does a dedicated event bus pay off?** F2 trigger says "≥ 2 internal consumers need the same event stream." No candidate today. Worth revisiting if we split the monolith into services — but that's a different PDR.
- **CDC vs logical replication vs dual write for a future search index.** F1 trigger says "full-text search becomes a product requirement." Design conversation when it does — CDC is clean-but-operational, logical replication is Aurora-native, dual write is simple-but-risky.
- **Per-org vs per-grant sequence scope on LedgerEntry (Ch 9 P2).** If per-org ships, F8 partitioning becomes cheaper but is still deferred on latency signals.
- **Does BenefitsSafe ever need OLAP / warehouse analytics?** F6 trigger is vague ("BI / product analytics become a real need"). Likely not until meaningful paying traffic.
- **Retention policy for `ProcessedWebhookEvent`.** The table grows unbounded; nothing prunes it today. At 1.8M orgs × N events/org/month it will eventually pose index-size questions. Stripe's retry window is 72 hours — rows older than ~1 week are safe to archive / drop. Out of scope for this doc, but surfaced for a future operations PDR.

---

## References

- Kleppmann, *Designing Data-Intensive Applications*, 1st ed., O'Reilly 2017. Chapter 11.
- DDIA Ch 7 applied doc: [`ddia-ch07-transactions-applied.md`](./ddia-ch07-transactions-applied.md).
- DDIA Ch 9 applied doc: [`ddia-ch09-consistency-consensus-applied.md`](./ddia-ch09-consistency-consensus-applied.md).
- BSRS Ch 5 applied doc: [`bsrs-ch05-least-privilege-applied.md`](./bsrs-ch05-least-privilege-applied.md).
- BSRS Ch 8 applied doc: [`bsrs-ch08-resilience-applied.md`](./bsrs-ch08-resilience-applied.md).
- Aurora role-separation SQL: [`../../scripts/db/create-aurora-roles.sql`](../../scripts/db/create-aurora-roles.sql).
- Webhook idempotency helper: [`../../lib/webhook-idempotency.ts`](../../lib/webhook-idempotency.ts).
- QStash queue + claimJobMessage + acquireCronLock: [`../../lib/queue/index.ts`](../../lib/queue/index.ts).
- Cron checkpoint (consumer-offset) helper: [`../../lib/cron-checkpoint.ts`](../../lib/cron-checkpoint.ts).

---

*Generated 2026-04-19 during BenefitsSafe security-hardening session. Verified against commit `1a85c88`. Scorecard mirrors Ch 7 / Ch 9 format for cross-doc consistency.*

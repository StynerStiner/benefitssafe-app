# DDIA Chapter 9 (Consistency and Consensus) Applied to BenefitsSafe

**Reference:** Kleppmann, *Designing Data-Intensive Applications* (1st ed.), Chapter 9, pp. 321–370.

**Scope:** Map every Ch 9 concept — linearizability, ordering, total order broadcast, distributed transactions, consensus — onto BenefitsSafe's current architecture. Identify where we need each guarantee, where we intentionally don't, and where a gap still exists. Companion to `ddia-ch07-transactions-applied.md` (single-node isolation) and `bsrs-ch08-resilience-applied.md` (failure handling + CAP/PACELC trade-off).

**Audit date:** 2026-04-19
**Codebase commit at audit time:** `dffbe1b`
**Prior Ch 9 work:** commit `06e0cd9` ("consensus and linearizability audit — 3 HIGH fixes"). That audit fixed three things we do not re-propose below:
- Stripe billing webhook event-time ordering (`BillingSubscription.lastBillingEventAt`).
- Platform `switch-org` atomicity (wrapped in `$transaction`).
- `acquireCronLock` per-acquisition owner token + CAS release via Lua.

---

## 0. Stack baseline

- **Single-leader storage:** AWS Aurora PostgreSQL cluster writer. Commit order on the writer IS the total order for everything financial. No dual-writer design. Read replica (`DATABASE_READ_URL`) is provisioned but currently unused.
- **ORM:** Prisma v7, custom client at `lib/generated/prisma/`. Default isolation Read Committed; explicit Serializable on 3 financial sites (see Ch 7 doc §6).
- **Redis:** Upstash serverless, keyed by `${DEPLOY_CHANNEL}` prefix (stable vs canary) so channels don't stomp each other's state. Used for rate limits, stripe-circuit state (per-Lambda, not Redis-backed — see BSRS Ch 8 P1), `cachedWithStaleness` degraded-mode reads (BSRS Ch 8 P2c), cron locks (`acquireCronLock`), and messageId dedup (`claimJobMessage`).
- **Queue:** Upstash QStash for background jobs. Authenticated via EdDSA HMAC (`Receiver.verify()` at [lib/queue/index.ts:117-135](../../lib/queue/index.ts#L117-L135)). Every job invocation receives a QStash `Upstash-Message-Id` header we dedup on.
- **Stripe:** Webhook retries for up to 3 days on non-2xx. Three webhook endpoints — `/api/webhooks/stripe` (Issuing JIT + transaction settlement + disputes + Connect account updates), `/api/webhooks/stripe-billing` (our own subscription billing), `/api/webhooks/stripe-charges` (Issuing charge events). Dedup by `event.id` via [`ProcessedWebhookEvent`](../../prisma/schema.prisma) (line 1018).
- **Deployment topology:** BSRS Ch 8 P3 splits production across two Vercel deployments (canary 10% / stable 90%) behind a Cloudflare router Worker. **Both share the same Aurora writer, the same Redis instance (with channel-prefixed keys), and the same Stripe account.** The failure-domain split is explicitly *not* a dual-writer split — this matters for every linearizability claim below.
- **Operator contract:** webhooks, jobs, crons, and event endpoints are carved out at the router to always route to stable (see `cloudflare/workers/benefitssafe-router.js` lines 5-9). Canary never processes a webhook or cron; it only handles user requests. This keeps the ordering stories simple: ordering invariants only live on one channel.

This matters because every guarantee below is conditioned on "Aurora single writer is the linearization point" and "webhooks/jobs/crons only execute against stable."

---

## 1. Consistency Guarantees (DDIA §9.1)

**DDIA's framing:** a system isn't "consistent" or "inconsistent" — it picks a model out of a lattice (linearizable > sequential > causal > eventual). BenefitsSafe's model is not uniform. Different paths pick different guarantees on purpose.

| Path | Effective model | Mechanism |
|---|---|---|
| Money writes (approve, settle, issue card, refund) | Linearizable | Serializable SSI + conditional UPDATE + SELECT FOR UPDATE on single Aurora writer (see Ch 7 §6). |
| Status-machine writes (expense pending → approved, vendor pending → active, invite usedAt) | Linearizable per entity | `updateMany WHERE status=:expected` compare-and-set on Aurora. |
| Webhook event processing | Linearizable at the event-id level; **causally ordered** at the entity level via `event.created` guard | `ProcessedWebhookEvent` unique dedup + `lastBillingEventAt` in `stripe-billing` (see §4). |
| Dashboard / list reads under healthy Aurora | Linearizable (Aurora-sourced) | Read Committed against the single writer; no replication lag because `DATABASE_READ_URL` is unused. |
| Dashboard / list reads under **degraded/down Aurora** | Bounded-staleness (eventual with an explicit bound) | `cachedWithStaleness` at [lib/cache.ts:103-120](../../lib/cache.ts#L103-L120) returns `{kind:"stale", staleSeconds, cachedAt}` with `maxStaleSeconds` cap. Client sees `_meta.staleness` envelope + `X-Data-Staleness` header. |
| Notifications fan-out | Best-effort | Fired outside money `$transaction`s (see Ch 7 §P2 on `handleTransactionCreated`). Partial-failure tolerated by design — money correctness first. |
| Audit logs | Best-effort atomicity with the originating write | Most sit inside the business `$transaction`; a few (cron summary writes) are standalone. |

**The guarantee is per-path, not global.** Future sections verify each path against its declared guarantee.

---

## 2. Linearizability (DDIA §9.2)

DDIA §9.2: linearizability = "behaving as if there is a single copy of the data, and every operation on it takes effect atomically at some point between its invocation and response." Synonym: "strong consistency," "atomic consistency," "register consistency."

### 2.1 Where we actually need linearizability

- **Grant balance arithmetic.** Two concurrent charges against the same grant must not both pass a balance check that should only have passed for one. Covered by [`handleTransactionCreated`](../../app/api/webhooks/stripe/route.ts) at line 518-574: `$transaction` → `SELECT ... FOR UPDATE` on the Grant row → update spent/remaining → write LedgerEntry with `balanceAfter` computed inside the tx. Post-Ch 7, the grant row can legitimately go negative on settlement (`allowNegativeBalance = true` on the overspend branch) because Stripe has already moved the money; the invariant "ledger matches Stripe" takes priority over "balance ≥ 0."
- **Expense state machine.** Approve / reject / issue-card / close are all compare-and-set via `updateMany WHERE status=:expected`. Approve at [app/api/expenses/[id]/approve/route.ts:101-235](../../app/api/expenses/%5Bid%5D/approve/route.ts#L101) is the gold-standard site: `retryOnSerializationFailure` wrapper + Serializable tx + `ApprovalConflictError` on compare-and-set miss.
- **Unique-per-entity constraints.** `VirtualCard @@unique([expenseId])` at [prisma/schema.prisma:489](../../prisma/schema.prisma#L489) (one card per expense); partial unique index `uniq_active_card_per_grant_beneficiary` (one ACTIVE card per grant-beneficiary pair); `User.email`, `Organization.orgCode`, `Vendor.vendorCode`, etc. Twenty `@unique`/`@@unique` declarations in total.
- **Membership role grants.** Expiring grants at [app/api/cron/revoke-expired-grants/route.ts](../../app/api/cron/revoke-expired-grants/route.ts) — enforcement is NOT dependent on the cron (α gate in `auth.ts` + β gate in `lib/auth-guard.ts#requirePlatformAdmin` both check `expiresAt` at request time, so an expired grant is unusable even if the cron is late). The cron only backfills `revokedAt` timestamps. This is a Ch 9 defense-in-depth pattern: don't rely on an async job to uphold an authorization invariant.
- **Fund transfers.** `FundTransfer @@unique([organizationId, requestId])` at [prisma/schema.prisma:1044](../../prisma/schema.prisma#L1044). Client supplies the idempotency key; DB uniqueness enforces "one transfer per request."

### 2.2 How we implement linearizability

We piggyback on PostgreSQL's linearizability, not Paxos/Raft at the app layer:

1. **Aurora single writer** is the sole commit point for every money-touching write.
2. **Serializable SSI** on financial tx blocks gives us linearizability across rows inside one tx.
3. **`SELECT ... FOR UPDATE`** on hot rows (Grant in `handleTransactionCreated`, Grant in `grants/[id]/route.ts` PATCH, Grant in `process-charge/route.ts`) gives us linearizability across concurrent tx that both touch the same row.
4. **`retryOnSerializationFailure`** at [lib/db.ts:78-116](../../lib/db.ts#L78-L116) converts transient SSI aborts (P2034 / 40001 / 40P01) into retries rather than user-facing 500s.
5. **UNIQUE constraints** catch phantoms that `updateMany` cannot (e.g. two concurrent inserts racing on `VirtualCard.stripeCardId`).

### 2.3 Where we intentionally *don't* have linearizability

- **JIT authorization (`handleAuthorizationRequest` at [app/api/webhooks/stripe/route.ts:158-420](../../app/api/webhooks/stripe/route.ts#L158))** reads grant balance *without* a lock to meet Stripe's 2-second decision deadline. This is a conscious latency-over-consistency choice. Correctness is recovered afterwards by `handleTransactionCreated`'s Serializable settlement — if JIT approves optimistically and the grant has since been debited elsewhere, the settlement path commits the debit with `overspent: true` and alerts admins within the dispute window.
- **Degraded-mode dashboard reads.** `cachedWithStaleness` returns a value up to `maxStaleSeconds` old (tuned per route in `STALE_CACHE_TTL` at [lib/cache.ts:118-125](../../lib/cache.ts#L118)). Clients see this as `_meta.staleness` in the response — the staleness bound is surfaced, not hidden. This is DDIA "bounded staleness" made visible.
- **Read-your-writes for a user who just mutated data during Aurora degraded mode.** `invalidateCacheByPrefix(CACHE_KEYS.orgXxx)` best-efforts a Redis key purge after each write, so the next read repopulates fresh. If Redis itself is unavailable at invalidation time, the user will see stale data on their next read until `maxStaleSeconds` elapses. Documented trade-off; no current gap.

### 2.4 Cost — DDIA §"The Cost of Linearizability"

DDIA §9.2 notes the CAP trade-off: you can't have linearizability AND availability under a network partition. Our choice is spelled out in §6 below and implemented by BSRS Ch 8 P2.

---

## 3. Implementing Linearizable Systems (DDIA §9.2 "Implementing Linearizable Systems")

DDIA lists four approaches to implementing linearizability: single-leader replication (linearizable), consensus (linearizable), multi-leader replication (not linearizable), leaderless replication (probably not linearizable).

**BenefitsSafe uses single-leader replication.** Aurora's cluster writer is the sole leader; failover is the only mechanism that moves the leader role. All reads today go to the writer; read replicas exist at the Aurora cluster level but `DATABASE_READ_URL` is unset in practice.

**Why this matters for BSRS Ch 8 P3 (two failure domains):**

BSRS Ch 8 P3 splits Vercel into two deployments (canary 10% / stable 90%) but — explicitly — they share the **same** Aurora writer (see [docs/design-notes/bsrs-ch08-p3-design.md](./bsrs-ch08-p3-design.md) §5 "Aurora role separation"). Both channels run application code against the same writer endpoint; the only separation is the Postgres ROLE they connect as (tighter permissions on canary for blast-radius limiting).

This keeps the Ch 9 linearizability story intact: the writer is still a single linearization point, and the ordering established by commit time is still the global total order.

**Forward-looking constraint:** if a future PDR ever introduces a second Aurora writer (e.g. multi-region active-active for disaster recovery), the invariants in §2.1 will break — `SELECT FOR UPDATE` does not cross writers, and two transactions on different writers can both pass the same balance check. Any such PDR must introduce app-level fencing (e.g. monotonic grant versions) before shipping. This is not a gap today; it's a gate on future work.

---

## 4. Ordering Guarantees (DDIA §9.3)

DDIA §9.3 argues that ordering, causality, and consensus are intertwined — a total order broadcast (and therefore linearizability) is equivalent to consensus.

### 4.1 Causal ordering via event-time guards

Stripe delivers every event with `event.created` (Stripe's own clock, at second resolution). We use this as the causal clock for handlers that mutate long-lived state across multiple events for the same entity.

**Applied correctly — Stripe billing webhook ([app/api/webhooks/stripe-billing/route.ts](../../app/api/webhooks/stripe-billing/route.ts)):** every `invoice.*` and `customer.subscription.*` handler takes `eventAt = new Date(event.created * 1000)` and guards its UPDATE via:

```ts
updateMany({
  where: {
    id: existing.id,
    OR: [{ lastBillingEventAt: null }, { lastBillingEventAt: { lt: eventAt } }],
  },
  data: { ..., lastBillingEventAt: eventAt },
});
if (result.count === 0) {
  console.warn("[stripe-billing] ... arrived out-of-order, skipping");
}
```

This was the Ch 9 fix in `06e0cd9` and remains in place across `handleSubscriptionCreated` / `Updated` / `Deleted`, `handleInvoicePaid`, `handleInvoicePaymentFailed`, plus the sync-status branches (lines 304, 329, 399, 499, 511, 579, 601).

**GAP-1 — Dispute status updates drop later events.** [app/api/webhooks/stripe/route.ts:838-889](../../app/api/webhooks/stripe/route.ts#L838) (`handleDisputeUpdated`). The guard is a `findFirst` on `AuditLog { entityId: disputeId, action: "dispute_updated" }` and early-return if found. That is a **one-shot** dedup: the first `dispute_updated` event writes an audit log; every subsequent status transition (a dispute moves through `warning_needs_response` → `warning_under_review` → `warning_closed`, or `needs_response` → `under_review` → `lost`/`won`) matches the guard and returns 200 with no DB effect. Side consequence: `Transaction.status` is set to `"disputed"` by `handleDisputeCreated` but never advances to `dispute_lost` / `dispute_won` because that transition would have to live in `handleDisputeUpdated`.

Proposed fix is cataloged below as **P1**.

**GAP-2 — `handleAccountUpdated` has no event-time guard.** [app/api/webhooks/stripe/route.ts:676-726](../../app/api/webhooks/stripe/route.ts#L676) writes `Organization.bankConnectedAt = new Date()` only when all three of `charges_enabled`, `payouts_enabled`, `details_submitted` are true, and never unsets the field. That is a one-directional latch: once onboarded, always onboarded in our DB. Defensible product choice — we don't want a stale webhook to silently un-onboard a nonprofit — but the code doesn't document it as a choice and re-runs the UPDATE on every retry without ordering consideration. Catalogued below as **P3** (DEFENSIBLE).

**Stripe Issuing JIT (`handleAuthorizationRequest`)** intentionally skips dedup (comment at [app/api/webhooks/stripe/route.ts:101-113](../../app/api/webhooks/stripe/route.ts#L101)): Stripe needs a fresh approve/decline within 2s on every retry, and the handler re-reads the card + grant on every call, so it is idempotent by construction without a dedup row. No gap.

### 4.2 Sequence numbers and total order broadcast

DDIA §9.3 distinguishes **causal order** (partial) from **total order** (every event sortable). For audit / reconciliation, total order matters: an auditor scanning a day's LedgerEntry rows expects a deterministic ordering.

**Application-level sequence generators in use:**

- `orgCode` (`ORG-00001`), `vendorCode` (`VN-0001-00001`), `memberCode` (`TM-0001-00001`), `beneficiaryCode`, `promoCode.code` — all generated via the MAX+1-with-retry pattern. Example at [app/api/vendors/route.ts:327-369](../../app/api/vendors/route.ts#L327) — compute `codePrefix`, read current max, increment, attempt insert, catch P2002, retry up to 3× with re-read of max. Works. Not a bug. Inefficient at high concurrency.
- Prisma `@default(cuid())` on `id` columns — globally unique, sortable lexicographically by time of generation at the Prisma client, not authoritative on commit order.

**GAP-3 — LedgerEntry has no monotonic commit-order sequence.** [prisma/schema.prisma:564-584](../../prisma/schema.prisma) LedgerEntry block. The table is explicitly immutable (no `updatedAt`) and uses `createdAt: DateTime @default(now())`. Postgres `now()` is transaction-start-time, not commit-time, and has millisecond precision. Two concurrent Serializable tx that both write LedgerEntry rows against different grants can produce rows with identical `createdAt`. Chronological scan for audit is not guaranteed deterministic.

Settlement-path LedgerEntries are indirectly ordered by the `reference = transaction.id` Stripe id (natural-key dedup, see [app/api/webhooks/stripe/route.ts:494-497](../../app/api/webhooks/stripe/route.ts#L494)) but that only orders entries for ONE grant's Stripe-sourced charges. Approval-path entries (Ch 7 §1) have no such natural order.

**What DDIA says:** if you need total order across entries, either (a) route all writes through a single leader and use the leader's commit order (we do this — but `createdAt` with ms precision is a lossy projection of it), or (b) attach a monotonic sequence at write time (Postgres `SEQUENCE` / `GENERATED ALWAYS AS IDENTITY`).

Proposed fix is cataloged below as **P2**.

### 4.3 Lamport / vector clocks

Not used. We don't need cross-service causal clocks because:
- All financial state is on one Aurora writer (one linearization point).
- Cross-service events (Stripe → us, QStash → us) carry their own causal clocks (`event.created`, `Upstash-Message-Id`) which are sufficient at the webhook / job boundary.

### 4.4 Total order broadcast and consensus equivalence

DDIA §9.3: total order broadcast is equivalent to linearizable compare-and-swap, which is equivalent to consensus.

For BenefitsSafe, Aurora's writer provides total order broadcast "for free" — every commit is a broadcast event in the storage replication layer. We don't run a separate broadcast system (Kafka, Pulsar) at the application layer. See [`ddia-ch11-stream-processing-applied.md`](./ddia-ch11-stream-processing-applied.md) §2 for the broader discussion of how BenefitsSafe already applies stream-processing discipline without a separate broker; a future PDR that introduces Kafka-style partitioned logs would change this section's invariants.

---

## 5. Distributed Transactions and Consensus (DDIA §9.4)

### 5.1 No 2PC / XA

DDIA §9.4 argues that heterogeneous 2PC across independent systems is operationally miserable (coordinator bottleneck, holding locks during coordinator failure, XA's dirty-write-on-recovery hazard).

BenefitsSafe **does not use 2PC or XA** anywhere. Specifically we refuse to do:

- Open a Stripe API call *inside* a Prisma `$transaction`. The verification check (BSRS Ch 8 P1 audit) confirms every Stripe call is OUTSIDE the tx. Stripe card creation happens BEFORE the DB write, with a compensating `stripe.issuing.cards.update({status:"canceled"})` on DB failure.

### 5.2 Saga pattern with compensation

The Stripe × Aurora write across `issue-card` is a saga:

```
1. Pre-check (DB read: expense exists + in PENDING_ISSUANCE + user has permission)
2. Stripe create card  (external, with idempotency key `card-exp-${expense.id}-${mode}`)
3. DB $transaction: VirtualCard.create + ExpenseRequest.status → PAID + AuditLog
4. On step-3 failure: stripe.issuing.cards.update(id, {status:"canceled"})  — the compensation
5. Orphan sweep cron catches step-4 failures:  app/api/cron/reconcile-orphan-stripe-cards/route.ts
```

Both issue-card paths implement this:
- Expense-driven: [app/api/expenses/[id]/issue-card/route.ts:519-679](../../app/api/expenses/%5Bid%5D/issue-card/route.ts#L519)
- Grant-direct: [app/api/grants/[id]/issue-card/route.ts:461-586](../../app/api/grants/%5Bid%5D/issue-card/route.ts#L461)

The orphan sweep cron is the compensation for the compensation — it reconciles any Stripe card whose DB row never landed (including the rare case where step-4 itself fails). Hourly schedule in the Cloudflare cron Worker, 15-minute `MIN_AGE_MINUTES` floor so we never race a live issue-card mid-flight.

This is explicit DDIA §9.4 saga pattern. It works because both steps are idempotent:
- Stripe create uses an idempotency key → retries return the same card.
- DB write is guarded by `@@unique([expenseId])` → retries either succeed or hit P2002 which the handler treats as "card already linked."

### 5.3 Fencing tokens

DDIA §8 (not §9 directly, but referenced from §9.4 "Fault-Tolerant Consensus") recommends monotonic fencing tokens on every lock so a "zombie" worker whose lease expired cannot corrupt shared state.

BenefitsSafe's `acquireCronLock` at [lib/queue/index.ts:194-261](../../lib/queue/index.ts#L194) implements **owner tokens** (per-acquisition UUID + Lua CAS on release) — safe to release your own lock, will not release someone else's — but does NOT implement full monotonic fencing tokens that downstream writes must validate.

This is a conscious choice documented in the code (lines 208-218):
> "It does NOT provide full fencing tokens (monotonic counters validated on every downstream write) — the cron jobs in this codebase all rely on DB-level entity idempotency (unique constraints, `claimJobMessage`, per-warning `entityId` dedup) as the real line of defense. The owner token is the minimum hardening that keeps the lock itself safe to release."

Translated: our locks are advisory, not enforcing. The enforcing layer is the database (natural-key uniqueness on every entity a cron writes to). A zombie worker that wakes up after its lease expired cannot do damage because every row it tries to write either conflicts with a newer row or hits P2002 on a natural key. Documenting the chain of reasoning here so a future reader sees that "no fencing tokens" is intentional, not missed.

### 5.4 Consensus

We don't run Paxos / Raft / ZooKeeper / etcd. The two places that look consensus-shaped are actually single-leader:

- **Aurora cluster failover** (replica promoted to writer) — handled by AWS at the storage layer. Application sees it as a brief unavailability; BSRS Ch 8 P2 degraded-mode absorbs it.
- **Cloudflare Worker router picking a channel** (canary vs stable) — this is a weighted random choice with cookie-based stickiness, not consensus. The Worker does not agree with other Workers on which channel a user goes to; each Worker invocation makes its own choice, and the `bs_channel` cookie makes subsequent requests from the same user sticky. No ordering or agreement required.

**If** BSRS Ch 8 P3f (auto-rollback cron) ships one day, that cron would need to atomically swap the Cloudflare LB pool weights. Today, weight changes go through an API call to Cloudflare, which is itself a single-leader system (their LB control plane) — we don't need to build consensus, we piggyback on theirs.

---

## 6. BSRS Ch 8 interaction — CAP / PACELC

DDIA §9.2 "The Cost of Linearizability" and §9.4 make the CAP trade-off concrete: during a network partition, a system can either **refuse to respond** (CP) or **serve potentially stale data** (AP). Outside of partitions, PACELC extends it: either **low-latency** or **consistent** — pick one.

BenefitsSafe makes the choice **per-request**:

| Condition | Reads | Writes |
|---|---|---|
| Aurora healthy | Linearizable (Aurora) | Linearizable (Aurora + Ch 7 Serializable) |
| Aurora **degraded** (500ms ≤ p95 < 3000ms) | Still linearizable — probe reports `degraded` but writes + reads proceed; client-side banner informs the user things are slow | Still linearizable (writes proceed) |
| Aurora **down** (p95 ≥ 3000ms or probe timeout) | Bounded-staleness from Redis stale cache, `maxStaleSeconds` per route (typical 600s), surfaced via `_meta.staleness` + `X-Data-Staleness` header | Fail fast with 503 + Retry-After — `DbUnavailableError` at [lib/db-health.ts:65-74](../../lib/db-health.ts#L65) |

**Per-request PACELC classification:**
- **Partitioned (DB down):** AP for reads, CP for writes. We explicitly choose availability over consistency for the read path and consistency over availability for the write path.
- **Non-partitioned (else):** Latency over Consistency for cached paths (stale cache TTLs gate freshness), Consistency over Latency for money paths (Serializable tx + FOR UPDATE, willing to pay the abort-retry cost).

The `_meta.staleness` envelope — `{kind: "stale" | "fresh" | "unavailable", staleSeconds, cachedAt}` at [lib/cache.ts:103-111](../../lib/cache.ts#L103) — is the DDIA "bounded-staleness contract" made visible to every client. A dashboard that renders stale data tells the user how stale it is rather than silently lying.

This is all implemented by BSRS Ch 8 P2; see [bsrs-ch08-resilience-applied.md](./bsrs-ch08-resilience-applied.md) §5 P2 row for the scorecard and per-Tier retrofit history. The Ch 9 doc's role is to **name the choice** so a future engineer doesn't try to "fix" the stale-cache path by making it linearizable — the non-linearizability is the feature.

---

## 7. Open Issues and Action Items

Ordered by **leverage ÷ fix-cost**. Every row cites the DDIA section it's grounded in, the specific file, and the effort.

### P1 — OPEN — `handleDisputeUpdated` event-time ordering (DDIA §9.3)

**File:** [app/api/webhooks/stripe/route.ts:838-889](../../app/api/webhooks/stripe/route.ts#L838)

**What's broken:**

The handler's idempotency guard is `prisma.auditLog.findFirst({ where: { entityId: disputeId, action: "dispute_updated" } })` → early-return 200 if any such row exists. That is one-shot dedup keyed on *(dispute, action)*, not on *(dispute, event.id)* or *(dispute, event.created)*. Once the first `dispute_updated` event lands, every subsequent status transition for that dispute (e.g. `warning_needs_response` → `warning_under_review` → `warning_closed`, or `needs_response` → `under_review` → `lost` / `won`) matches the guard and returns 200 with no DB effect.

Side consequence: `Transaction.status` is set to `"disputed"` by `handleDisputeCreated` but never advances to a terminal `dispute_lost` / `dispute_won` because the transition would have to live in `handleDisputeUpdated`, which silently no-ops after the first event.

**What to ship:**

1. Add `Dispute` as a first-class entity OR add `Transaction.lastDisputeEventAt` + `Transaction.disputeStatus` columns. (Design choice — the lighter option is adding two columns to Transaction.)
2. Guard every mutation in `handleDisputeUpdated` via `updateMany WHERE lastDisputeEventAt IS NULL OR < :eventAt` (the same shape `stripe-billing` uses).
3. Advance `Transaction.disputeStatus` on terminal outcomes (`lost`, `won`, `warning_closed`).
4. Keep writing one AuditLog per event (drop the existing one-shot guard — log every event, dedupe only by `ProcessedWebhookEvent` which already handles event-id dedup at the outer layer).

**Effort:** 1–2 hours (schema + handler edit + test). Pattern is proven in `stripe-billing`.

**Leverage:** High. Fixes a silent product gap (we never record dispute outcomes) AND closes a Ch 9 ordering gap. Eligible to land in the same PDR as P2 if we're already opening a migration.

---

### P2 — OPEN — LedgerEntry monotonic commit-order sequence (DDIA §9.3)

**File:** [prisma/schema.prisma:564-584](../../prisma/schema.prisma)

**What's broken:**

LedgerEntry is immutable and append-only but ordering depends on `createdAt: DateTime @default(now())`. `now()` returns transaction-start time at millisecond precision. Two concurrent Serializable tx that write LedgerEntry rows — possibly against the same grant under contention — can have identical `createdAt`. Chronological audit scan is non-deterministic in tie-breaking.

For many purposes this is harmless: `reference` (Stripe transaction id) breaks ties for settlement-sourced entries, and human reviewers don't care about microsecond order. It matters for:
- Reconciliation cron's ledger-by-grant scan at [app/api/cron/reconciliation/route.ts](../../app/api/cron/reconciliation/route.ts) (deterministic ordering simplifies cursor pagination).
- Auditor-facing exports where row order is part of the artifact's reproducibility.

**What to ship:**

Expand-contract migration ([docs/runbooks/expand-contract-migrations.md](../runbooks/expand-contract-migrations.md)):

1. **Expand:** add `seq BIGINT GENERATED ALWAYS AS IDENTITY` column (nullable on existing rows), index `(organizationId, seq)`. Backfill existing rows ordered by `(createdAt ASC, id ASC)` to preserve current ordering.
2. **Cutover:** update the two writer sites (`handleTransactionCreated` settlement and approval-path ledger writes) to select and expose `seq` in their return types. Update reconciliation scanner to order by `seq` instead of `createdAt`.
3. **Contract:** once everything reads `seq`, drop the composite `createdAt, id` index if no other reader uses it.

Scope question: **per-organization or per-grant sequence scope?** Per-grant gives the tightest ordering for reconciliation but requires per-grant counters (a row in `GrantLedgerCounter` updated under the same tx as the LedgerEntry insert — cheap but an extra write). Per-organization uses a single pg SEQUENCE per org — even cheaper, but ties across grants. Recommend per-organization: reconciliation happens per org, and the looseness across grants is irrelevant because settlement already carries `reference` for tie-breaking within a grant.

**Effort:** 3–4 hours (migration + backfill script + two writer edits + reconciliation edit + tests). Standard expand-contract, no downtime.

**Leverage:** Medium. Audit-trace reproducibility + reconciliation cursor stability. Not money-at-risk.

---

### P3 — OPEN (DEFENSIBLE) — `handleAccountUpdated` event-time guard (DDIA §9.3)

**File:** [app/api/webhooks/stripe/route.ts:676-726](../../app/api/webhooks/stripe/route.ts#L676)

**What's "broken":**

Handler re-runs the UPDATE on every retry with no ordering guard. A stale `account.updated` retry arriving after a newer one can re-stamp `bankConnectedAt = new Date()` with whatever `new Date()` evaluates to at retry time. That's not a correctness bug on `bankConnectedAt` itself (we only SET it when `chargesEnabled && payoutsEnabled && detailsSubmitted`, and we never unset it — one-directional latch).

Where it could bite: we store `chargesEnabled, payoutsEnabled, detailsSubmitted` in the AuditLog `newValue` on every update, so the AuditLog timeline for a connected account has no guarantee of reflecting Stripe's actual state progression under retry-reorder.

**What to ship:**

Add `Organization.lastStripeAccountEventAt` + guard via `updateMany WHERE lastStripeAccountEventAt IS NULL OR < :eventAt`. Mirror `stripe-billing`. Keep the `bankConnectedAt` latch semantics (document them in the handler comment as an intentional choice).

**Effort:** ~1 hour.

**Leverage:** Low. `account.updated` is rare (a handful per org per lifetime), the latch is safe, and the AuditLog timeline already has `event.id` for causality if someone really needs to reconstruct order. Ship this when we're already touching the file for other reasons.

---

### P4 — OPEN (docs-only) — Document the PACELC choice (DDIA §9.1, §9.2)

**File:** this doc §6 + cross-reference in [bsrs-ch08-resilience-applied.md](./bsrs-ch08-resilience-applied.md) P2 row.

**What's "broken":**

The CAP / PACELC trade-off is implemented correctly (BSRS Ch 8 P2) but isn't explicitly framed anywhere as "we chose AP for reads, CP for writes, with bounded-staleness contract surfaced to clients." A future engineer auditing `cachedWithStaleness` for "why does this return stale data?" should be able to follow the chain: code → Ch 9 doc §6 → BSRS P2 PDR → PDR rationale.

**What to ship:**

This doc's §6 already frames it. Add one-line back-pointer in `bsrs-ch08-resilience-applied.md` P2 row: *"CAP/PACELC framing: see [`ddia-ch09-consistency-consensus-applied.md`](./ddia-ch09-consistency-consensus-applied.md) §6."* That edit is a single-line change to another docs file, deferred here — ship as part of the P4 landing commit or as a companion doc-update PR.

**Effort:** 30 minutes (docs-only).

**Leverage:** Low materially; prevents a future engineer from "fixing" the intentional staleness.

---

### P5 — DEFERRED — `releaseWebhookEvent` survives Lambda hard-kill (DDIA §9.3 / §9.4)

**File:** [lib/webhook-idempotency.ts:29-84](../../lib/webhook-idempotency.ts#L29)

**What's at risk:**

A webhook handler calls `markWebhookProcessed` (inserts the dedup row), begins the real work, then hits Vercel `maxDuration` OR Lambda OOM → the function is killed by the runtime → the outer `try { } finally { await releaseWebhookEvent() }` does **not** run. The ProcessedWebhookEvent row is stranded. Next Stripe retry lands, sees the row, returns `deduped:true`, and the actual event work is permanently dropped.

Mitigation today: Stripe retries for 3 days (~72 attempts), so the window of exposure is narrow. Every handler sets `maxDuration: 60` or `300` — generous enough that timeouts should be rare under normal operation. Hard kills from OOM or platform failure are a small residual risk.

**What a fix looks like:**

Two-phase claim/commit:

1. `claimWebhookEvent(eventId)` writes a row with short TTL (5 min) — represents "I'm working on this." Concurrent duplicate returns early.
2. `commitWebhookEvent(eventId)` upgrades the row to long-TTL (permanent-ish) after handler succeeds.
3. A reaper cron (or just the natural long-TTL window) reclaims orphaned short-TTL rows.

Alternative: out-of-band reconciliation — a daily cron that pulls `stripe.events.list(?)` and diffs against ProcessedWebhookEvent to surface dropped events. This is simpler but depends on operator attention.

**Effort:** 3–4 hours (two-phase) or 6 hours (reconciliation cron).

**Leverage:** Low. Hard kill + 3-day retry window + narrow time-of-exposure = low probability × low-to-moderate impact. Defer until we have evidence (e.g. a Better Stack alert on "Stripe event count drift") that this is actually happening.

---

### P6 — DEFERRED — pg `SEQUENCE` for `orgCode`, `vendorCode`, `memberCode`, `beneficiaryCode` (DDIA §9.3)

**Files:** [app/api/vendors/route.ts:327-369](../../app/api/vendors/route.ts#L327) (reference implementation of the MAX+1 + P2002 retry pattern), [lib/utils/membership-code.ts](../../lib/utils/membership-code.ts), plus the registration paths.

**What's at risk:**

Current MAX+1-with-retry works correctly but wastes round-trips under contention. At current scale (thousands of orgs, tens of thousands of vendors per large org) it's fine. At 1.9M-org projected scale it becomes a measurable latency tax for onboarding paths.

**What a fix looks like:**

Introduce a pg SEQUENCE per code type, scoped by org where appropriate. Instead of `MAX+1` + retry, use `nextval('vendor_code_seq_' || orgId)` to atomically reserve the next id. Drop the retry loop.

**Effort:** ~2 hours per code type, or ~6–8 hours bundled with end-to-end tests and coordinated migrations.

**Leverage:** Low at current scale; becomes leverage at 10×. Not a correctness fix — the retry loop is correct today. Defer.

---

## 8. What this audit establishes

DDIA Chapter 9 discipline is broadly applied to BenefitsSafe:

- **Linearizability** is correctly claimed where we rely on it (money paths, state machines, natural-key uniqueness), and it's correctly *not* claimed where we've traded it for availability (stale-cache reads) or latency (JIT authorization).
- **Ordering guarantees** are enforced on the paths where Stripe retries can legitimately arrive out of order (`stripe-billing` event-time guard, closed in `06e0cd9`). The remaining ordering gap is in `handleDisputeUpdated` (P1), with a smaller gap in `handleAccountUpdated` (P3) and a sequence-number gap on LedgerEntry (P2).
- **Consensus** is piggy-backed on Aurora's single-leader storage; we don't run app-layer consensus and don't need to.
- **Distributed transactions** are avoided (no 2PC). The Stripe × Aurora write uses the saga + compensation pattern, with a reconcile-orphan-stripe-cards cron as the compensation-for-the-compensation.
- **CAP / PACELC** is made an explicit per-request choice, not a global setting. BSRS Ch 8 P2 is the implementation; this doc's §6 is the framing.

Remaining work is narrow — three OPEN items (P1, P2, P3), two DEFERRED (P5, P6), and one docs-only (P4). Not a "rebuild the consistency layer" situation.

---

## 9. Cross-chapter ties

- **DDIA Ch 5 (Replication):** `ProcessedWebhookEvent` + `releaseWebhookEvent` on failure were Ch 5 fixes for "webhook events silently dropped when the DB hiccups" (the `.catch(()=>{})` anti-pattern). Ch 9's P5 is the remaining residual exposure from Lambda hard-kills.
- **DDIA Ch 7 (Transactions):** this doc's foundation. Serializable SSI + `SELECT FOR UPDATE` on money paths is the mechanism that makes §2 linearizability claims true.
- **DDIA Ch 8 (Distributed Systems):** circuit breaker + fail-fast timeouts + Lambda-per-instance state are the failure-mode backdrop every Ch 9 claim must survive. Prior commit `1097bb1` ("distributed systems audit — 4 CRITICAL + 11 HIGH fixes for network failure, retry, and clock drift") is the Ch 8 work Ch 9 sits on top of.
- **DDIA Ch 12 (Future of Data Systems):** the seal-cross-org-leaks work in `74cf1f0` is adjacent — it's a multi-tenant isolation invariant, enforced by Prisma client extension. Not directly Ch 9 but shares the "invariants on top of a single-leader store" pattern.
- **BSRS Ch 8 P2 (Degraded mode):** §6 above frames it as BenefitsSafe's explicit CAP / PACELC choice. The stale-cache `_meta.staleness` envelope is the bounded-staleness contract DDIA §9.1 describes.
- **BSRS Ch 8 P3 (Failure domains):** §3 above notes the shared-writer invariant; a future dual-writer design would break §2's claims and require a separate Ch 9 PDR.

---

## 10. Open questions for a future session

- **Per-org vs per-grant sequence scope on LedgerEntry (P2).** Per-org is cheaper and sufficient for reconciliation scans today; per-grant gives tighter ordering under the same grant for audit exports. Decide with finance / audit stakeholder input before shipping.
- **P1 dispute outcome schema: add columns to Transaction, or introduce a first-class Dispute model?** Lighter option is two columns; cleaner option is a separate model. Decide with product input — if we ever need to track multi-dispute-per-transaction (rare on Issuing), a separate model wins.
- **If `DATABASE_READ_URL` is ever re-enabled,** the linearizability claim on "dashboard reads" in §2 breaks — replica lag is not `maxStaleSeconds`-bounded. Either route only non-financial reports to the replica (and keep money paths on the writer) or treat replica reads the same way we treat stale-cache reads (surface `_meta.staleness`). Design conversation before enabling.
- **BSRS Ch 8 P3f (auto-rollback cron)** is deferred pending a quarter of manual-rollback data. If it lands, the decision-to-flip-weights is effectively a consensus-ish commit (you want exactly-once "flip" semantics). Piggybacking on Cloudflare's LB API single-leader should keep it out of Ch 9's scope, but worth re-auditing if the design changes.

---

## References

- Kleppmann, *Designing Data-Intensive Applications*, 1st ed., O'Reilly 2017. Chapter 9.
- Prior Ch 9 audit: commit `06e0cd9` ("consensus and linearizability audit — 3 HIGH webhook/lock/atomicity fixes").
- DDIA Ch 7 applied doc: [`ddia-ch07-transactions-applied.md`](./ddia-ch07-transactions-applied.md).
- BSRS Ch 8 applied doc: [`bsrs-ch08-resilience-applied.md`](./bsrs-ch08-resilience-applied.md).
- BSRS Ch 8 P3 design: [`bsrs-ch08-p3-design.md`](./bsrs-ch08-p3-design.md).
- Expand-contract migration runbook: [`../runbooks/expand-contract-migrations.md`](../runbooks/expand-contract-migrations.md).
- PostgreSQL SSI notes: https://www.postgresql.org/docs/current/transaction-iso.html#XACT-SERIALIZABLE
- Martin Kleppmann, "How to do distributed locking" (fencing tokens): https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html

---

*Generated 2026-04-19 during BenefitsSafe security-hardening session. Verified against commit `dffbe1b`. Scorecard mirrors Ch 7's format for cross-doc consistency.*

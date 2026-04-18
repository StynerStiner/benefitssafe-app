# DDIA Chapter 7 (Transactions) Applied to BenefitsSafe

**Reference:** Kleppmann, *Designing Data-Intensive Applications* (1st ed.), Chapter 7, pp. 221–268.

**Scope:** Map every concept in DDIA Ch 7 to a specific location and behavior in the BenefitsSafe codebase. Identify what isolation level we actually get from Aurora PostgreSQL + Prisma, what race conditions are possible, and what (if anything) to change at 1.9M-org scale.

**Audit date:** 2026-04-17
**Codebase commit at audit time:** `227e920`

---

## 0. Stack baseline

- **Database:** AWS Aurora PostgreSQL (cluster writer endpoint; commented-out RDS Proxy + read-replica variants)
- **ORM:** Prisma v7 with custom client output at `lib/generated/prisma/`
- **Default isolation level:** Read Committed (PostgreSQL default; Aurora inherits it; we do not globally override it)
- **Transaction API in use:** `prisma.$transaction()` with interactive callbacks; explicit Serializable isolation on specific financial sites
- **Retry primitive:** `retryOnSerializationFailure()` defined at `lib/db.ts:78-116` — exponential backoff + jitter, handles Prisma P2034 and PostgreSQL 40001 / 40P01 / "could not serialize access" / "deadlock detected"
- **Concurrency model:** Next.js serverless / Lambda — multiple Node instances concurrently hit Aurora. All concurrency control comes from the database.

This matters because every section below answers "given Read Committed on Aurora + Prisma + the explicit Serializable upgrades we already have, what anomalies remain?"

---

## 1. The Slippery Concept of a Transaction (ACID)

**DDIA's framing:** ACID ≠ a universal standard. Each letter has vendor-specific nuance.

### Atomicity

**Where it lives in BenefitsSafe — VERIFIED:**

Every money-movement path uses `prisma.$transaction`. 17 call sites across the app:

- `app/api/expenses/[id]/approve/route.ts:102` — status transition + conditional Grant debit + BudgetCategory update + LedgerEntry + Approval + AuditLog (all inside Serializable tx wrapped by `retryOnSerializationFailure`)
- `app/api/expenses/[id]/reject/route.ts:66` — status gate + audit
- `app/api/expenses/[id]/issue-card/route.ts:469` — VirtualCard create + ExpenseRequest.status → PAID + AuditLog (Serializable), with Stripe idempotency key and compensation on failure
- `app/api/jobs/process-charge/route.ts:132,204,267` — auto-approval money flow with Serializable
- `app/api/virtual-cards/[id]/close/route.ts:84,199` — card status race guard with Serializable
- `app/api/virtual-cards/[id]/pause/route.ts:49` — pause status transition
- `app/api/grants/[id]/route.ts:125` — Grant PATCH with SELECT FOR UPDATE lock
- `app/api/grants/[id]/issue-card/route.ts:480` — grant-direct card issuance
- `app/api/webhooks/stripe/route.ts:489` — Stripe settlement (`handleTransactionCreated`) with SELECT FOR UPDATE on Grant
- `app/api/auth/accept-invite/route.ts:177` — user activation + membership + audit
- `app/api/auth/register/route.ts:262` — user + membership + audit
- `app/api/auth/reset-password/route.ts:108` — user + InviteToken invalidate + audit
- `app/api/admin/data-deletion/route.ts:110` — data deletion
- `app/api/platform/switch-org/route.ts:68` — membership rebind
- `app/api/memberships/[id]/route.ts:51` — membership mutation
- `app/api/platform/internal-staff/route.ts:254` — staff role change

**One notable gap:** Fund transfer (`app/api/org/fund/route.ts`) does NOT wrap its post-Stripe writes (FundTransfer update + AuditLog) in a `$transaction`. This is defensible — the money has already moved at Stripe, and the `FundTransfer` row with a unique constraint on `(organizationId, requestId)` is the source of truth. A crash between the status update and the audit log write would leave a SUCCEEDED transfer without audit record. Cosmetic, not money-at-risk.

**Status:** SAFE. Atomicity is correctly applied where it matters.

### Consistency

**Application-level invariants:**

- **Ledger double-entry:** Maintained by application code. Every approval/debit runs a conditional Grant UPDATE first, then inserts a LedgerEntry with the pre-computed `balanceAfter` field. No DB-level CHECK constraint enforces `sum(credits) == sum(debits)`. Comment in `prisma/schema.prisma:564-584` documents LedgerEntry as immutable (no `updatedAt`).
- **Grant balance ≥ 0:** Application-enforced via `UPDATE Grant SET remainingAmount = remainingAmount - :amount WHERE id = :id AND remainingAmount >= :amount` pattern. No DB-level CHECK constraint. One intentional exception: Stripe settlement path at `app/api/webhooks/stripe/route.ts:498-503` allows negative balance because Stripe already moved the money — records `overspent: true` and fires an alert.
- **Expense state machine:** Every transition uses `updateMany WHERE status = :expected` (compare-and-set). Illegal transitions fail silently (count === 0).

**Risk at 1.9M-org scale:** Current application-level enforcement is correct. The exposure is a future handler that forgets the conditional UPDATE pattern. DB-level CHECK would be belt-and-suspenders at zero runtime cost.

**Status:** APP-ONLY — correct today, lacks a second line of defense.

### Isolation

**What we actually run at:**

- Default: Read Committed (PostgreSQL default, unchanged)
- Explicit Serializable upgrade on 3 financial sites:
  - `app/api/expenses/[id]/approve/route.ts:235`
  - `app/api/virtual-cards/[id]/close/route.ts:199`
  - `app/api/jobs/process-charge/route.ts:267`

This is call-site granular — non-financial `$transaction`s stay at Read Committed (cheap, low abort rate), money paths get Serializable (correct, willing to pay the abort cost).

**Status:** SAFE where it matters. See section 6 for SSI details.

### Durability

Aurora provides 6-way storage replication across 3 AZs and automated PITR. Scoped application role (per `docs/runbooks/aurora-credential-rotation.md`, deferred) will lock down drop-cluster privileges.

**Status:** SAFE. Durability is Aurora's strong suit.

---

## 2. Single-Object vs Multi-Object Operations

**Single-object writes:** Safe by PostgreSQL's default single-row atomicity. The 97 `prisma.auditLog.create` callsites, 24 `prisma.notification.create` callsites, and most status flips fall here.

**Multi-object transactions:** All 17 `prisma.$transaction` sites cover multi-table mutations. Every money-movement path is wrapped.

### Handling errors and aborts (retry-on-serialization-failure)

**`retryOnSerializationFailure()` at `lib/db.ts:78-116`:**

```ts
export async function retryOnSerializationFailure<T>(
  fn: () => Promise<T>,
  options?: { maxAttempts?: number; baseDelayMs?: number }
): Promise<T>
```

Handles: Prisma P2034, PostgreSQL 40001 (serialization_failure), 40P01 (deadlock_detected), "could not serialize access", "deadlock detected". Exponential backoff with jitter. Default 3 attempts.

**Usage gap (findable fix):**

- `app/api/expenses/[id]/approve/route.ts:101` — wraps the Serializable tx. ✓
- `app/api/virtual-cards/[id]/close/route.ts:199` — Serializable tx WITHOUT retry wrap. ✗
- `app/api/jobs/process-charge/route.ts:267` — Serializable tx WITHOUT retry wrap. ✗

At 1.9M-org scale, contention will eventually hit 40001. Without the retry wrap on these two sites, it surfaces as a 500 to the user instead of retrying silently.

**Status:** Util exists and is correct. Two call sites need wiring. 15-minute fix.

---

## 3. Weak Isolation: Read Committed (our default)

PostgreSQL's default. Guarantees: no dirty reads, no dirty writes.

**What Read Committed does NOT prevent:**
- Read skew on multi-query aggregates → affects reports
- Lost updates on read-modify-write → but we use atomic SQL, so this doesn't bite us
- Write skew on check-then-act on different rows → but we use Serializable on the paths where this matters
- Phantoms on existence-checks → partially covered by UNIQUE constraints, partially by Serializable

### Read skew in reports

**`app/api/reports/grants/route.ts:32-40`** runs `Promise.all([findMany, count])` at Read Committed. Between the two queries, rows can be inserted/deleted — `total` may not match `reports.length + offset`.

**Risk:** Acceptable for dashboard UX (eventually consistent). Real risk is funder-facing grant reports that auditors might compare to other records. If auditors require point-in-time consistency, wrap in `$transaction` at RepeatableRead isolation.

**Status:** Low priority. Verify auditor requirements before changing.

---

## 4. Snapshot Isolation and Preventing Lost Updates

**Snapshot Isolation** (PostgreSQL's "Repeatable Read") is not used anywhere by default in BenefitsSafe. Not a problem — Serializable is strictly stronger and that's what the financial paths use.

### Lost Update prevention — VERIFIED

Every hot path that decrements Grant balance uses atomic SQL with a guard clause. No read-then-write cycles found.

Grant balance decrement call sites, all ATOMIC:

1. **`app/api/expenses/[id]/approve/route.ts:131-138`** — raw SQL:
   ```sql
   UPDATE "Grant" SET "spentAmount" = ..., "remainingAmount" = ... - $amount
   WHERE id = $id AND "remainingAmount" >= $amount::numeric
   ```

2. **`app/api/jobs/process-charge/route.ts:215-223`** — same pattern with `RETURNING "remainingAmount"` for single-round-trip balance read.

3. **`app/api/grants/[id]/route.ts:125-171`** — SELECT ... FOR UPDATE → recompute → update (Serializable-compatible).

4. **`app/api/webhooks/stripe/route.ts:489-544`** — SELECT ... FOR UPDATE → conditional debit with documented overspend semantics (intentionally commits debit even when `remainingAmount < chargeAmount` because Stripe already moved the money; sets `overspent: true` and alerts).

**UsageCounter increments at `lib/usage-tracker.ts:48-63`** use Prisma's `{ increment: amount }` operator which compiles to `SET col = col + $1`. Atomic. Safe at Read Committed.

**Compare-and-set (40+ call sites):** Widespread and correct. Every state-machine transition uses `updateMany WHERE status = :expected` and checks `count > 0`.

**Status:** SAFE. Codebase has DDIA Ch 7 lost-update discipline throughout.

---

## 5. Write Skew and Phantoms — VERIFIED

This is where I expected to find risks. Agent found the codebase is well-defended:

### Write skew sites — all protected

**Double-approval of expense:**
- `app/api/expenses/[id]/approve/route.ts:108` — `updateMany({ where: { id, status: "PENDING" } })` with `count === 0` check raising `ApprovalConflictError`.
- Wrapped in Serializable `$transaction`.
- **Protected.** Second approver sees the state gate, transaction aborts, caller gets 409.

**Fund exhaustion:**
- Same path. The `WHERE "remainingAmount" >= $amount` clause in the raw UPDATE is the atomic guard. If second transaction finds balance < amount, `grantUpdated === 0` → `ApprovalConflictError("insufficient_grant_funds", ...)`.
- **Protected.** The DB refuses the overdraft.

**Duplicate Stripe card assignment:**
- `app/api/expenses/[id]/issue-card/route.ts:438` — Stripe idempotency key `card-exp-${expense.id}-${issuing.mode}` (same expense → same Stripe card on retry).
- `VirtualCard.@@unique([expenseId])` at `prisma/schema.prisma:488` — DB-enforced one-card-per-expense.
- On DB P2002, handler calls `stripe.issuing.cards.update(cardId, { status: "canceled" })` to compensate — no orphaned Stripe cards.
- **Protected.** Triple defense: idempotency key, DB unique, Stripe compensation.

**Invite token redemption race:**
- `app/api/auth/accept-invite/route.ts:177-209` — membership transition uses `updateMany WHERE status: "pending"` (compare-and-set). ✓
- User + InviteToken use plain `update` — not guarded on `usedAt: null`. ✗
- **Partial.** Two concurrent submissions of the same token would both succeed at default isolation, last-write-wins on User.passwordHash (not a security issue — same user, same token, both passwords from the same session). Cosmetic. 10-minute fix.

### Phantom protection

- UNIQUE constraints cover the typical phantoms: User.email, VirtualCard.stripeCardId (shipped tonight in Migration 3), Organization.orgCode, VirtualCard.expenseId.
- Phantoms without natural unique key are protected by Serializable isolation on the specific transactions where they could occur.

**Status:** Write skew and phantoms are handled correctly across money-movement paths.

---

## 6. Serializability — VERIFIED

PostgreSQL's `Serializable` level implements SSI (Serializable Snapshot Isolation) since 9.1. That's what we use on financial paths.

**What we actually use:**

```ts
await prisma.$transaction(async (tx) => { ... }, {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 5_000,
  timeout: 15_000,
});
```

**Deployed on 3 sites** (section 2 above). Gold-standard pattern combines:
- Serializable isolation
- Conditional atomic UPDATE (for balance invariants)
- Status-gated `updateMany` (for state machine transitions)
- `retryOnSerializationFailure()` wrap (but missing on 2 of 3 — see section 2)
- In-transaction AuditLog writes

**SELECT FOR UPDATE — 3 legitimate sites:**
- `grants/[id]/route.ts:132` — Grant PATCH lock for recompute
- `process-charge/route.ts:209` — belt-and-suspenders with Serializable
- `webhooks/stripe/route.ts:494` — Stripe settlement lock

**Advisory locks:** None. Not needed — Serializable + FOR UPDATE cover all observed contention patterns.

**Status:** SAFE. Codebase runs serializable where it matters, with the correct PostgreSQL primitive (SSI).

---

## 7. Open Issues and Action Items

**Verified real issues, ranked by severity × fix-cost:**

### Priority 1 — CLOSED in commit `70808ee`

**V15-close / V15-process-charge: wire `retryOnSerializationFailure()` on the two Serializable tx blocks missing it.**

Two Serializable `$transaction` sites were missing the retry shell — `app/api/virtual-cards/[id]/close/route.ts` and `app/api/jobs/process-charge/route.ts`. Under real contention at 1.9M-org scale, Postgres 40001/40P01/P2034 errors would surface as user-facing 500s instead of transparent retry.

**What shipped:** `retryOnSerializationFailure(() => prisma.$transaction(...))` wrapping added at both sites. Both now match the gold-standard pattern at `app/api/expenses/[id]/approve/route.ts:101`. Retry utility at `lib/db.ts:78-116` — 3 attempts, exponential backoff 50→100→200ms with ±25% jitter, non-retryable errors propagate immediately.

### Priority 2 — CLOSED in commit `dea1876`

**V6: wrap `handleDisputeCreated` in `$transaction`.**

`app/api/webhooks/stripe/route.ts` `handleDisputeCreated` held a non-atomic sequence: Transaction.update (status → disputed), AuditLog.create, and a for-loop of Notification.create × N admins. If the fan-out errored mid-iteration, the Transaction was marked disputed with a partial notification set — some compliance officers would miss the alert.

**What shipped:** the four internal writes are now inside `prisma.$transaction(async (tx) => { ... })`, mirroring the sibling `handleTransactionCreated` pattern in the same file. Dedupe `findFirst` and transaction lookup stay outside the wrap (read-only early-return is correct). Read-Committed isolation preserved — atomicity is the goal, not serializability; there's no write-skew scenario on this path.

*Interaction note:* commit `54926d8` subsequently fixed a latent `AuditLog` NOT NULL bug that became load-bearing under the new atomic wrap (every dispute would have rolled back). Both commits are required for the dispute path to work correctly. See `docs/audits/README.md`.

### Priority 3 — CLOSED in commit `dab2f0f`

**V18: compare-and-set on invite token redemption.**

`app/api/auth/accept-invite/route.ts` redeemed invite tokens without a concurrency guard. Double-submit produced duplicate audit rows and a brief window where two requests could both believe they'd successfully redeemed.

**What shipped:** invite token redemption now uses `prisma.inviteToken.updateMany({ where: { id, usedAt: null }, data: { usedAt: new Date() } })` inside the array-form `$transaction`. Concurrent redemptions: the second caller's update affects 0 rows — Prisma returns `{ count: 0 }` and the handler treats it as already-redeemed. Array-form `$transaction` preserved (Option A from the PDR) — other writes in the tx remain idempotent; worst-case residual is a cosmetic duplicate audit log entry on the losing race.

### Priority 4 — CLOSED in commit `07c6611` (Approach B)

**V7 / V8: DB-level CHECK constraints on money invariants.**

Application-level enforcement of `remainingAmount >= 0` was correct but not defense-in-depth; a future handler that forgot to check could land a corrupting write. A naïve CHECK would conflict with the intentional overspend path at `handleTransactionCreated` (Stripe settlement can legitimately produce a negative balance briefly).

**What shipped:** Approach B — `Grant` gained an `allowNegativeBalance BOOLEAN NOT NULL DEFAULT false` column. Three CHECK constraints now enforce strict invariants at the DB level:
- `totalAmount >= 0`
- `spentAmount >= 0`
- `remainingAmount >= 0 OR allowNegativeBalance = true`

`handleTransactionCreated` in `webhooks/stripe/route.ts` is the one site that flips `allowNegativeBalance = true`, and only on the overspend branch (conditional spread, not unconditional). Every other write path is locked to non-negative balances at the DB level.

**Follow-up design question (open):** once `allowNegativeBalance` is set, it stays true. Reset policy — manual reconciliation, auto on first positive-balance restoration, or time-based — deferred to a future design conversation. Non-urgent; current behavior is defensible. Tracked under "Open questions for a future session" below.

The `LedgerEntry` cumulative-sum invariant (originally part of this priority) was deferred: single-row CHECKs are cheap, but cumulative-sum constraints across multiple rows require a trigger, and the exact invariant shape (sum-per-grant? sign-per-type? both?) warrants its own design pass.

### Priority 5 — CLOSED in commit `07c6611`

**V16: confirm partial unique index side-script was applied to Aurora.**

`prisma/schema.prisma` declares `@@unique([expenseId])` on `VirtualCard`, which permits unlimited `expenseId = NULL` rows. The grant-direct issuance path (no expense) could race and produce multiple active cards per (grant, beneficiary) pair. A separate script at `scripts/add-virtual-card-unique-constraints.ts` defined the partial unique index but had never been applied to Aurora — Prisma's migration system doesn't manage side-scripts.

**What shipped:** the partial unique index is now applied via the migration at `prisma/migrations/20260417220000_grant_allow_negative_balance_and_checks/migration.sql`:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_active_card_per_grant_beneficiary"
  ON "VirtualCard" ("grantId", "beneficiaryId")
  WHERE status = 'ACTIVE';
```

`IF NOT EXISTS` makes the statement idempotent. Enforces at the DB level that at most one `ACTIVE` VirtualCard exists per `(grantId, beneficiaryId)` pair.

**V17 (reports snapshot isolation)** remains deferred. `reports/grants/route.ts` still runs at Read Committed. Upgrade only if regulatory/audit requirements demand point-in-time consistency; no such requirement has surfaced.

---

## Status summary

All five action items from this section shipped on 2026-04-17. Section 6 (Serializability verification) was already complete; the P4 follow-up on `allowNegativeBalance` reset policy is the only design question remaining from section 7 and is tracked below under "Open questions for a future session."

A separate defense-in-depth initiative — the Prisma client-extension for org-scoping enforcement — was scoped and shipped its Phase 1 shadow-mode rollout on the same day (commit `9428032`). That extension is tracked in `docs/audits/README.md` and its design document at `docs/design-notes/prisma-org-scoping-extension-design.md`, not here.

---

## 8. What this audit establishes

The codebase already applies DDIA Chapter 7 discipline at a high level:

- Serializable isolation on financial paths (not just transactions, but the right kind of transaction)
- Atomic conditional UPDATE for every balance mutation
- Compare-and-set on every state transition
- `SELECT FOR UPDATE` where explicit locking beats optimistic concurrency
- Retry-on-serialization-failure utility with exponential backoff
- UNIQUE constraints wherever phantoms can be captured by a natural key
- Stripe idempotency keys with DB compensation on failure

The gaps are small: 2 missing retry wraps, 1 missing `$transaction` wrap, 1 cosmetic compare-and-set. Plus a design conversation about DB-level money invariants.

**Not a "rebuild the transaction layer" situation.** An "apply polish to the existing correct patterns" situation.

---

## Open questions for a future session

- **Aurora SSI semantics:** Does Aurora preserve PostgreSQL's exact SSI behavior, or does it alter it? The behavior we rely on is standard PostgreSQL SSI. AWS documentation review needed.
- **RDS Proxy + `SELECT FOR UPDATE`:** Commented-out in `.env.local` but may be enabled later. Proxies can break explicit row locks if connection pinning isn't configured. Verify before re-enabling.
- **Long-running read replica use:** If `DATABASE_URL_READONLY` is re-enabled, reports could run there. But read replicas lag — this changes the read-skew story. Design question before enabling.

---

## References

- Kleppmann, *Designing Data-Intensive Applications*, 1st ed., O'Reilly 2017. Chapter 7.
- PostgreSQL docs: Transaction Isolation — https://www.postgresql.org/docs/current/transaction-iso.html
- Prisma docs: Interactive Transactions — https://www.prisma.io/docs/orm/prisma-client/queries/transactions

---

*Generated 2026-04-17 during BenefitsSafe security-hardening session. Verified against commit `227e920`.*

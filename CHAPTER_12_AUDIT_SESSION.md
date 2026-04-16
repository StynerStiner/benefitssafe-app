# Chapter 12 Audit — Session Record

**Date:** 2026-04-15 to 2026-04-16
**Auditor:** Claude Code (Opus 4.6) via VS Code
**Operator:** Styner
**Scope:** Financial paths — expense approval, card issuance, ledger operations, grant fund balance, OFAC screening, SentinelLayer agents, webhook handlers, fund transfers
**Framework:** DDIA Chapter 12 (Kleppmann, "The Future of Data Systems")

---

## Executive Summary

A forensic Chapter 12 compliance audit of BenefitsSafe's financial paths identified 24 confirmed defects across 6 defect classes. All CRITICAL and HIGH-severity defects on the pre-launch critical path were fixed, verified with verbatim code quotes, and deployed to the live codebase. The fixes span cross-org data isolation, financial atomicity, ACH double-charge prevention, and production-grade status polling infrastructure.

**Before this session:** 9 confirmed cross-org data leaks, 2 grant overdraw vulnerabilities, 1 ACH double-charge vulnerability, 0 end-to-end request ID protection on fund transfers, 0 status polling infrastructure.

**After this session:** 0 open cross-org leaks on audited paths, 0 open financial atomicity defects on audited paths, production-grade FundTransfer model with durable DB-level dedup, tenant-isolated status polling endpoint with rate limiting and security audit logging, production-grade frontend polling with full lifecycle cleanup.

---

## Defect Classes Identified

| Class | Name | Count | Severity | Status |
|-------|------|-------|----------|--------|
| C-1 | Missing end-to-end request IDs | 1 | CRITICAL | Deferred to Phase 2B (expense create idempotency) |
| C-2 | Grant balance atomicity (unconditional decrement) | 2 | CRITICAL | **FIXED** |
| C-3 | External financial API without durable dedup | 4 | CRITICAL | **1 FIXED** (ACH fund), 3 deferred (card issuance key rotation) |
| C-4 | Cross-org data leaks (missing organizationId) | 9 | CRITICAL | **ALL FIXED** |
| C-5 | Unbounded table growth | 5 tables | HIGH | Cataloged, deferred to Phase 2B |
| C-6 | WorkflowEngine.fire double-fire on retry | 4 | HIGH | Cataloged, deferred to Phase 2B |

---

## Fixes Applied (with file paths and verification)

### Fix 1: Cross-Org Data Leak — CCPA Data Export
**File:** `app/api/user/data-export/route.ts`
**Defect:** 4 Prisma queries filtered by userId/beneficiaryId without organizationId, leaking financial data (grants, expenses, documents, cards) across all orgs a user belongs to.
**Fix:** Added `organizationId: orgId` to every where clause.
**Queries fixed:**
- `prisma.grant.findMany` — L41: `where: { beneficiaryId: userId, organizationId: orgId }`
- `prisma.expenseRequest.findMany` — L53: `where: { requestedById: userId, organizationId: orgId }`
- `prisma.document.findMany` — L64: `where: { organizationId: orgId, OR: [...] }`
- `prisma.virtualCard.findMany` — L78: `where: { beneficiaryId: userId, organizationId: orgId }`
**Verified:** All 5 queries (4 fixed + 1 already correct auditLog) contain organizationId at the top level.

### Fix 2: Cross-Org Data Leak — Run-Compliance Velocity Check
**File:** `app/api/jobs/run-compliance/route.ts`
**Defect:** Velocity count query at L166-L171 filtered by requestedById without organizationId, inflating velocity counts across orgs. A beneficiary in 500 orgs gets flagged as high-velocity when they're normal in each org.
**Fix:** Added `organizationId: orgId` to the where clause at L168.
**Verified:** Where clause now reads `{ organizationId: orgId, requestedById: expense.requestedById, createdAt: { gte: oneHourAgo } }`.

### Fix 3: Cross-Org Data Leak — Vendor Dashboard
**File:** `app/(dashboard)/(homes)/vendor-dashboard/page.tsx`
**Defect:** Vendor lookup at L44 filtered by `userId` without `organizationId`, causing nondeterministic first-vendor-row selection across orgs. Downstream transaction queries inherited the wrong org's data.
**Fix:** Added `organizationId: session.user.organizationId` to the vendor findFirst where clause.
**Verified:** Where clause now reads `{ userId: session.user.id, organizationId: session.user.organizationId, archivedAt: null }`.

### Fix 4: Cross-Org Data Leak — Vendor Payments Beneficiary Lookup
**File:** `app/api/vendors/[id]/payments/route.ts`
**Defect:** User lookup at L112 filtered by `{ id: { in: beneficiaryIds } }` without organizationId.
**Fix:** Added `organizationId` to the where clause.
**Verified:** Where clause now reads `{ id: { in: beneficiaryIds }, organizationId }`.

### Fix 5: Cross-Org Data Leak — Messages User Lookup
**File:** `app/api/messages/conversations/[id]/route.ts`
**Defect:** User lookup at L81 filtered by `{ id: { in: Array.from(allUserIds) } }` without organizationId.
**Fix:** Added `organizationId` to the where clause.
**Verified:** Where clause now reads `{ id: { in: Array.from(allUserIds) }, organizationId }`.

### Fix 6: Grant Overdraw — Process-Charge Auto-Approve
**File:** `app/api/jobs/process-charge/route.ts`
**Defect:** Auto-approve path at L198-L204 used Prisma `{ increment/decrement }` without a conditional `WHERE remainingAmount >= amount` guard. Two concurrent auto-approves on the same grant could both succeed and drive the balance negative.
**Fix:** Replaced with atomic conditional `$queryRaw` UPDATE with `RETURNING "remainingAmount"`:
- `WHERE id = ${grantId} AND "remainingAmount" >= ${Number(amount)}::numeric`
- Row-count check via `result.length === 0` throws `InsufficientFundsError`
- Added `isolationLevel: Prisma.TransactionIsolationLevel.Serializable` with `maxWait: 5_000, timeout: 15_000`
- Added `InsufficientFundsError` class and outer catch handler that marks Transaction as "declined" and ExpenseRequest as "REJECTED"
**Also added:** `import { Prisma } from "@/lib/generated/prisma/client"` for the isolation level enum.
**Verified:** All 6 verification items YES (atomic UPDATE, row-count check, Serializable isolation, FOR UPDATE lock, RETURNING-based balanceAfter, no refactor outside fix scope).

### Fix 7: Grant Balance Credit-Back — Card Close Phantom Constraint
**File:** `app/api/virtual-cards/[id]/close/route.ts`
**Defect:** Credit-back UPDATE at L110-L116 subtracted from Grant.spentAmount and BudgetCategory.spentAmount without conditional guards. A comment at L107-108 claimed a "DB-level CHECK constraint on Grant.remainingAmount (added in Ch3)" that does not exist anywhere in the schema or migration scripts.
**Fix:**
- Replaced Grant UPDATE with atomic conditional `$queryRaw` with `WHERE "spentAmount" >= ${unspent}::numeric AND "organizationId" = ${organizationId}` and `RETURNING "remainingAmount"`
- Replaced BudgetCategory UPDATE with same pattern: `WHERE "spentAmount" >= ${unspent}::numeric AND "organizationId" = ${organizationId}` and `RETURNING "spentAmount"`
- Row-count checks throw `InvalidCreditBackError` on zero rows
- Added `isolationLevel: Prisma.TransactionIsolationLevel.Serializable` to the existing `$transaction`
- Replaced phantom-constraint comment with accurate comment describing the real mechanism
- Added `InvalidCreditBackError` handler in outer catch returning 400 (terminal, not transient)
**Verified:** All 10 verification items YES.

### Fix 8: ACH Double-Charge — End-to-End Request ID for Fund Transfers
**Files modified:**
- `prisma/schema.prisma` — Added FundTransfer model with `@@unique([organizationId, requestId])`, reverse relations on Organization and User
- `prisma/migrations/20260416072244_add_fund_transfer/migration.sql` — CREATE TABLE, indexes, foreign keys
- `app/api/org/fund/route.ts` — Full POST handler rewrite

**Defect:** Time-bucketed Stripe idempotency key (`ibt-${orgId}-${amount}-${paymentMethod}-${timeBucket}`) with 5-minute rotation and no DB-level dedup record. A retry after the bucket rolls over creates a second ACH pull of real money.

**Fix (schema):**
- New `FundTransfer` model: id, organizationId, requestId (client UUID), amountCents (Int), currency, bankPaymentMethodId, stripeTransferId, stripeAccountId, financialAccountId, status (PENDING/SUCCEEDED/FAILED), failureReason, initiatedByUserId, createdAt, updatedAt
- `@@unique([organizationId, requestId])` — the dedup gate
- `@@index([organizationId, createdAt])` and `@@index([status])`
- Reverse relations: `Organization.fundTransfers FundTransfer[]` and `User.fundTransfers FundTransfer[]`

**Fix (backend):**
- Added zod validation with `requestId: z.string().uuid()` (required)
- Removed time-bucket idempotency key construction entirely
- New deterministic Stripe key: `ibt-${organizationId}-${requestId}`
- Pattern: INSERT FundTransfer (PENDING) -> catch P2002 (return existing row state) -> Stripe call -> UPDATE FundTransfer (SUCCEEDED/FAILED) -> AuditLog
- P2002 handler returns existing row state: SUCCEEDED -> 200 with `previouslyInitiated: true`, PENDING -> 409 with `retryable: true`, FAILED -> 422 with `retryable: false`
- Stripe failure: FundTransfer updated to FAILED, generic error to client (no Stripe internals leaked)
- Dev mock path uses `crypto.randomUUID()` instead of `Date.now()`
- All 6 existing authz checks preserved verbatim

**Fix (migration):**
- File: `prisma/migrations/20260416072244_add_fund_transfer/migration.sql`
- Applied to Aurora via `npx prisma migrate deploy`
- Prisma client regenerated and FundTransfer table verified live

**Verified:** All 18 verification items YES.

### Fix 9: Frontend — Client-Generated Request ID
**File:** `app/(dashboard)/org-settings/page.tsx`
**Function:** `handleAddFunds` (L420-L494)
**Fix:**
- Added `const requestId = crypto.randomUUID()` inside handleAddFunds (generated per click, not per render)
- Added `requestId` to fetch body
- Replaced `if (!res.ok)` pattern with `switch (res.status)` handling 200, 200+previouslyInitiated, 409, 422, 400, 401, default
- Added defensive `res.json().catch(() => ({}))` parsing
- 409 case closes dialog, clears amount, starts polling (see Fix 11)
**Verified:** All 13 verification items YES.

### Fix 10: Status Polling Endpoint
**File:** `app/api/org/fund/[transferId]/status/route.ts` (NEW)
**Supporting:** `lib/rate-limit.ts` (added `fundStatusPoll` config)

**Endpoint:** GET /api/org/fund/[transferId]/status

**Security gates (in order):**
1. Authn (session required) -> 401
2. User lookup (org + role) -> 400
3. Rate limit (1 req per 2 sec per userId:transferId, before authz) -> 429
4. Authz (nonprofit_admin or platform_admin) -> 403
5. Tenant-isolated FundTransfer lookup (`where: { id: transferId, organizationId }`) -> 404

**Rate limit:** Uses existing `rateLimitAsync` from `lib/rate-limit.ts` with new `fundStatusPoll` config (maxRequests: 1, windowMs: 2000). Fails open on Redis outage.

**Audit log strategy:**
- 200: NO AuditLog (high-frequency read path)
- 403: AuditLog with `action: "authz_failure"` (security-relevant)
- 429 (sustained): AuditLog with `action: "rate_limit_violation"` gated by 60-second Redis cooldown (`audit-cooldown:fund-status:${userId}`)
- 500: AuditLog with `action: "internal_error"`, `errorClass` only (no raw error.message to avoid PII leakage)

**Response:** 8 fields only (id, status, amountCents, currency, createdAt, updatedAt, stripeTransferId, failureReason). Excludes bankPaymentMethodId, initiatedByUserId, financialAccountId, stripeAccountId.

**Observability:** Every code path logs `[fund-status] user=... transferId=... status=...` for greppable structured logs.

**Verified:** All 18 verification items YES.

### Fix 11: Frontend Status Polling
**File:** `app/(dashboard)/org-settings/page.tsx`

**New refs added (8):**
- `isMountedRef` — prevents setState-on-unmount warnings
- `pollIntervalRef` — stores setInterval ID for cleanup
- `pollTimeoutRef` — stores initial setTimeout ID for cleanup
- `pollAbortRef` — stores AbortController for fetch cancellation
- `pollErrorCountRef` — consecutive error counter (3-error stop)
- `pollAttemptCountRef` — attempt counter (18-attempt / 90-second ceiling)
- `pollTransferIdRef` — active transfer ID (read by boundTick from ref, not closure)
- `boundTickRef` — ceiling-enforcing tick wrapper (used by visibility resume)

**New functions (3):**
- `pollTick(transferId)` — single fetch + response handling (SUCCEEDED/FAILED/PENDING/429/404/401/403/error)
- `stopPolling()` — aborts controller, clears timeout + interval, nulls all refs
- `startPolling(transferId)` — creates fresh AbortController, resets counters, shows loading toast, schedules boundTick

**New useEffect:**
- Visibility-aware: pauses interval on tab background, resumes with boundTickRef on foreground
- Unmount cleanup: sets isMountedRef false, removes listener, calls stopPolling
- Deps intentionally empty with explanatory comment

**Polling behavior:**
- 5-second interval (well clear of 1 req/2 sec rate limit)
- 2-second initial delay before first tick
- 18-attempt hard ceiling (90 seconds)
- 429 skips tick (no immediate retry)
- 3 consecutive errors stops polling
- SUCCEEDED: success toast (replaces loading via stable toast ID) + fetchFundBalance
- FAILED: error toast with failureReason
- Timeout: informational toast with hourglass icon
- Background tab: pauses interval, resumes with ceiling check on foreground return

**Cleanup contracts:**
- Component unmount: stopPolling via useEffect cleanup
- Concurrent submit: stopPolling at top of handleAddFunds
- Tab background: clearInterval (controller preserved for resume)
- All fetch calls pass AbortController.signal
- All setState calls guarded by isMountedRef.current check

**Verified:** All 21 verification items YES.

---

## Files Modified (Complete List)

| File | Change Type | What Changed |
|------|------------|-------------|
| `app/api/user/data-export/route.ts` | Edit | Added organizationId to 4 where clauses |
| `app/api/jobs/run-compliance/route.ts` | Edit | Added organizationId to velocity count where clause |
| `app/(dashboard)/(homes)/vendor-dashboard/page.tsx` | Edit | Added organizationId to vendor findFirst where clause |
| `app/api/vendors/[id]/payments/route.ts` | Edit | Added organizationId to user findMany where clause |
| `app/api/messages/conversations/[id]/route.ts` | Edit | Added organizationId to user findMany where clause |
| `app/api/jobs/process-charge/route.ts` | Edit | Replaced unconditional increment/decrement with atomic conditional UPDATE + RETURNING, added Serializable isolation, added InsufficientFundsError class and handler |
| `app/api/virtual-cards/[id]/close/route.ts` | Edit | Replaced unconditional credit-back UPDATE with atomic conditional UPDATE + RETURNING for both Grant and BudgetCategory, added Serializable isolation, added InvalidCreditBackError class and handler, replaced phantom-constraint comment |
| `prisma/schema.prisma` | Edit | Added FundTransfer model, reverse relations on Organization and User |
| `prisma/migrations/20260416072244_add_fund_transfer/migration.sql` | New | CREATE TABLE, indexes, foreign keys for FundTransfer |
| `app/api/org/fund/route.ts` | Edit | Full POST handler rewrite with zod validation, FundTransfer dedup, P2002 handling, deterministic Stripe idempotency key |
| `app/(dashboard)/org-settings/page.tsx` | Edit | Added requestId to fund body, response status handling, polling refs, pollTick/startPolling/stopPolling functions, visibility useEffect, handleAddFunds concurrent-submit cleanup |
| `app/api/org/fund/[transferId]/status/route.ts` | New | Tenant-isolated status polling endpoint with rate limiting and security audit logging |
| `lib/rate-limit.ts` | Edit | Added fundStatusPoll config (1 req per 2 sec) |

---

## Remaining Work (Phase 2B — Not Blocking Launch)

### Code-Level Fixes (days-to-weeks)
- C-1: Expense create idempotency (request_id + @@unique on ExpenseRequest)
- C-3: Card issuance Stripe key rotation (generation counter for re-issuance within 24h)
- C-6: WorkflowEngine.fire dedup (WorkflowExecution model with @@unique)

### Architectural Work (weeks-to-months)
- Data-access-layer rewrite: `orgPrisma(organizationId)` helper with lint-banned raw imports
- Partitioning: AuditLog, LedgerEntry, Notification, ProcessedWebhookEvent, Transaction
- Cold-storage: AuditLog + LedgerEntry hot 90d / cold-tier thereafter (S3 + Athena)
- Unified Stripe idempotency key helper (replace 16 scattered sites)
- ProcessedWebhookEvent retention cron (7-day purge)
- Notification read-archive cron (90-day window)
- Extract `useStatusPolling` custom hook from org-settings polling logic

### Phantom-Guarantee Audit
- Grep for "Ch1" through "Ch12" references in comments
- Verify every cited constraint, invariant, or safety mechanism actually exists
- The phantom CHECK constraint at virtual-cards/[id]/close/route.ts was the discovered instance — there may be others

---

## Scale-Law Compliance Statement

**Status: NOT YET (but launch-gate defects are closed).**

The 9 confirmed cross-org data leaks are sealed. The 2 financial atomicity bugs are sealed. The ACH double-charge vulnerability is replaced with a production-grade end-to-end request ID pattern. However, the codebase does not yet have a systemic defense against future cross-org leaks (the org-scoped data-access-layer rewrite is Phase 2B), and 5 append-only tables will require partitioning before reaching 10K+ orgs. The current fixes are point-correct; the architectural work to make them pattern-correct at 1.8M+ orgs is the next phase.

---

## Verification Protocol Used

Every fix in this session followed a strict verification protocol:
1. **Checkpoint-gated execution** — no edit applied without explicit "go" from the operator
2. **Verbatim code quotes** — every claim backed by freshly-read file content with line numbers
3. **Adversarial posture** — every finding assumed to be a pattern until proven contained
4. **Blast-radius analysis** — every defect class searched across the entire codebase before declaring it fixed
5. **Post-edit verification** — every modified file read back and every checklist item answered YES/NO from actual code, not proposed code
6. **No self-correction without instruction** — if a verification item came back NO, execution stopped and waited for explicit direction

This protocol caught multiple issues that would have shipped broken:
- The previous audit agent's claims were verified independently (3/3 CRITICAL findings confirmed)
- A phantom CHECK constraint referenced in a code comment was discovered to not exist in any schema or migration
- The card issuance Stripe idempotency key was found to have a 24-hour re-issuance collision window
- The initial setTimeout in the polling helper was identified as a cleanup leak and fixed with a timeout ref
- The visibility-resume path was identified as bypassing the 90-second polling ceiling and fixed with boundTickRef

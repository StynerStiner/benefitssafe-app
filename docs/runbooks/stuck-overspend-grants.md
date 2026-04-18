# Stuck Overspend Grants — Runbook

## What this is

A `Grant` with `allowNegativeBalance = true` whose `remainingAmount` has been restored (>= 0) but whose flag was never cleared back to `false`. The flag gets set to `true` only at one site — the Stripe settlement handler `handleTransactionCreated` in `app/api/webhooks/stripe/route.ts:512-519` — when a card charge settles for more than the grant's remaining balance (the 7-day Stripe dispute window race). Leaving the flag set after the balance is restored is not a data-integrity risk on its own (the CHECK constraint still enforces non-negative balance unless the flag is true), but it's technically stale state that should be cleaned up so the invariant lines up with reality.

## Auto-reset coverage (as of commit landing this runbook)

The auto-reset fires in exactly one place: [app/api/grants/[id]/route.ts](../../app/api/grants/[id]/route.ts) PATCH handler, inside the existing `$transaction`. When an admin updates a grant's `totalAmount` (a refill), the handler recomputes `remainingAmount` and then atomically clears the flag via `updateMany` guarded on `allowNegativeBalance: true AND remainingAmount >= 0`.

**Not covered by auto-reset** (operator must use the manual override below):

- Dispute-won restoration. `handleDisputeUpdated` in the Stripe webhook does not currently increment `Grant.remainingAmount` when a dispute is won. When that handler is built, the same five-line `updateMany` should be added there and this runbook updated.
- Off-ledger reconciliation write-downs (ledger correction that bypasses the grants PATCH path).
- Any other adjustment that doesn't flow through the `PATCH /api/grants/[id]` totalAmount path.
- Pre-revenue or seeded test data where the flag was set but no real refill will ever happen.

If you're reading this runbook, the grant is probably in one of those uncovered cases.

## How to find stuck grants

Run against the production DB (or read-replica if one is provisioned):

```sql
SELECT id,
       "organizationId",
       "remainingAmount",
       "allowNegativeBalance",
       "updatedAt"
FROM "Grant"
WHERE "allowNegativeBalance" = true
  AND "remainingAmount" >= 0
ORDER BY "updatedAt" ASC;
```

Grants in this result are stuck candidates — flag is `true` but balance is already non-negative. Oldest first, since those are most likely to reflect resolved incidents.

## Decision criteria before resetting

For each candidate:

1. Confirm the restored balance is real and not a settlement race. Cross-check against recent `Transaction` rows and the Stripe dashboard.
2. Verify the overspend incident is closed:
   - No pending dispute on the triggering transaction.
   - Dispute window (7 days from Stripe) has fully elapsed or the dispute has been resolved.
   - No expected chargebacks.
3. Pull the `AuditLog` rows for the original overspend event — understand what happened and whether the grant should be flagged for any other operational review.
4. If the grant is still under active review, do NOT reset. Leave the flag as signal.

## How to reset manually

**Endpoint:** `POST /api/platform/grants/:id/reset-negative-balance-flag`
**Auth:** `platform_admin` session. Nonprofit admins are deliberately excluded — resetting a compliance invariant on an org is a platform-level operation.
**Body:** `{ "reason": "<at least 10 characters>" }`. Reason is required and written verbatim to `AuditLog.newValue.reason`.

### Example (curl, with a copied session cookie)

```sh
curl -X POST https://app.benefitssafe.com/api/platform/grants/GRANT_ID/reset-negative-balance-flag \
  -H "Content-Type: application/json" \
  -H "Cookie: <auth cookie>" \
  -d '{"reason": "reconciled after dispute closed 2026-04-15, Stripe dispute D_1234 refunded in full"}'
```

### Expected responses

| Status | Meaning |
|---|---|
| `200 { grant: { id, organizationId, allowNegativeBalance: false, remainingAmount } }` | Reset succeeded. |
| `400 { error: "Reason must be at least 10 characters" }` | Reason missing or too short. Retry with a real reason. |
| `401 { error: "Unauthorized" }` | No session. |
| `403 { error: "Forbidden" }` | Session is not `platform_admin`. Do not escalate by changing roles — ask a platform admin to run this. |
| `404 { error: "Grant not found" }` | The grant id does not exist. |

A UI for this endpoint is **not yet implemented**; use curl or Postman. UI work is deferred to a later session.

## Audit trail

Every reset writes exactly one `AuditLog` row:

- `action`: `reset_negative_balance_flag`
- `entityType`: `grant`
- `entityId`: the grant id
- `userId`: the platform admin who ran the reset (real user id, not a sentinel)
- `organizationId`: the owning org of the grant (not the platform admin's session org)
- `oldValue`: `{ allowNegativeBalance: true, remainingAmount: <decimal as number> }`
- `newValue`: `{ allowNegativeBalance: false, reason: <operator reason>, resetBy: <user id>, resetAt: <ISO timestamp> }`

The update and the audit log are written atomically inside a `prisma.$transaction` — both land or neither does.

## Related

- Auto-reset implementation: [app/api/grants/[id]/route.ts](../../app/api/grants/[id]/route.ts) (look for `allowNegativeBalance` inside the PATCH `$transaction`)
- Endpoint implementation: [app/api/platform/grants/[id]/reset-negative-balance-flag/route.ts](../../app/api/platform/grants/[id]/reset-negative-balance-flag/route.ts)
- Flag-set site: [app/api/webhooks/stripe/route.ts:517](../../app/api/webhooks/stripe/route.ts) (`handleTransactionCreated` overspend branch)
- CHECK constraints: [prisma/migrations/20260417220000_grant_allow_negative_balance_and_checks/migration.sql](../../prisma/migrations/20260417220000_grant_allow_negative_balance_and_checks/migration.sql)
- Original design: [docs/design-notes/ddia-ch07-transactions-applied.md](../design-notes/ddia-ch07-transactions-applied.md) section 7 Priority 4

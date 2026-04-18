# Audit Log Weekly Review Runbook

## Purpose

BSRS Ch 5 (§5.3 "Best Practices — Auditing") calls for a human-in-the-loop review of privileged actions on a cadence short enough to catch a compromise before it cascades. At solo-operator scale this is a ~10-minute scan every week against the `AuditLog` table. The goal is not to investigate every row — it's to notice anything you don't immediately recognize, and to make the fact that review happens *at all* a known signal to anyone with an account.

See [docs/security/access-classification.md](../security/access-classification.md) for the classification that decides which actions demand the closest scrutiny.

## Cadence

- **When:** Monday morning, as part of the weekly retrospective.
- **Duration:** ~10 minutes. If any query below returns a row you don't recognize, stop the clock and investigate.
- **Log:** Append a row to the "Past reviews" table at the bottom of this file after every review, even the empty ones. An unbroken run of "clean" entries is itself evidence for a SOC 2 audit.

## Connect

Use the read-replica if one is provisioned. Otherwise connect to Aurora via the credentials in Vercel env `DATABASE_URL`. Do not run these against dev/staging — only production has interesting rows.

```sh
psql "$DATABASE_URL"
```

## Queries

The `AuditLog` schema is documented in [prisma/schema.prisma](../../prisma/schema.prisma): `userId`, `organizationId`, `action`, `entityType`, `entityId`, `oldValue` (JSON), `newValue` (JSON), `ipAddress`, `userAgent`, `createdAt`. It is IMMUTABLE (no `updatedAt`). Platform-level events use the sentinel `organizationId = 'SYSTEM'`.

### 1. Platform-admin actions (cross-org, highest scrutiny)

Every platform-level mutation lands in AuditLog with the operator's `userId`. Read every row.

```sql
SELECT
  al."createdAt",
  u.email AS operator_email,
  al."action",
  al."entityType",
  al."entityId",
  al."organizationId",
  al."newValue"
FROM "AuditLog" al
LEFT JOIN "User" u ON u.id = al."userId"
WHERE (
    al."organizationId" = 'SYSTEM'
    OR al."userId" IN (SELECT id FROM "User" WHERE "role" = 'platform_admin')
  )
  AND al."createdAt" > now() - interval '7 days'
ORDER BY al."createdAt" DESC;
```

**Red flags:**
- An `operator_email` that isn't yours.
- A `userId` value of `"system"` or `"system_webhook"` showing up with an action other than a known cron/webhook action (the `userId` field accepts these sentinels — see the BSRS applied doc §0).
- Any action on an org whose name you don't recognize.

### 2. Breakglass uses

Breakglass endpoints are the things that shouldn't fire in a normal week. If any of them fired, the reason is in `newValue->>'reason'` — read it.

```sql
SELECT
  al."createdAt",
  u.email AS operator_email,
  al."action",
  al."entityType",
  al."entityId",
  al."newValue"->>'reason' AS reason,
  al."newValue"
FROM "AuditLog" al
LEFT JOIN "User" u ON u.id = al."userId"
WHERE al."action" IN (
    'reset_negative_balance_flag'
    -- add new breakglass actions here as they ship
  )
  AND al."createdAt" > now() - interval '7 days'
ORDER BY al."createdAt" DESC;
```

**Red flags:**
- A breakglass call with no reason, a reason shorter than 10 chars (pre-commit-behavior only — the post-commit zod gate prevents this), or a reason like "test" / "asdf" / "temp".
- Repeated breakglass calls against the same `entityId` — suggests the underlying auto-recovery (see [stuck-overspend-grants.md](stuck-overspend-grants.md) §"Auto-reset coverage") has a gap that needs code-level fix, not repeated manual override.

### 3. Reason-required actions (terminal state transitions)

Per [docs/security/access-classification.md](../security/access-classification.md), grant terminal-status transitions and vendor rejections require a reason. Review every reason for substance.

```sql
SELECT
  al."createdAt",
  u.email AS operator_email,
  al."action",
  al."entityType",
  al."entityId",
  al."newValue"->>'status' AS new_status,
  al."newValue"->>'reason' AS reason
FROM "AuditLog" al
LEFT JOIN "User" u ON u.id = al."userId"
WHERE al."newValue" ? 'reason'
  AND al."createdAt" > now() - interval '7 days'
ORDER BY al."createdAt" DESC;
```

**Red flags:**
- Reason is technically ≥10 chars but is filler text ("closing grant", "done with this", "n/a reason"). At solo scale, you are both the writer and the reviewer — if you notice yourself writing filler, that's the signal to slow down.
- Reason doesn't match the action (e.g., a vendor rejection whose reason reads like a grant closure).

### 4. Delete operations

BenefitsSafe uses soft-delete almost everywhere (`archivedAt` field). A hard delete is rare and worth a second look.

```sql
SELECT
  al."createdAt",
  u.email AS operator_email,
  al."action",
  al."entityType",
  al."entityId",
  al."organizationId"
FROM "AuditLog" al
LEFT JOIN "User" u ON u.id = al."userId"
WHERE (al."action" ILIKE '%delete%' OR al."action" ILIKE '%archive%')
  AND al."createdAt" > now() - interval '7 days'
ORDER BY al."createdAt" DESC;
```

**Red flags:**
- Any delete on `entityType='grant'`, `entityType='ledger_entry'`, or `entityType='audit_log'` — these models are supposed to be immutable or soft-delete only. A hard delete suggests something reached past the application layer (direct psql, Prisma Studio, manual migration).
- A delete with `operator_email = NULL` — the `userId` didn't match a `User` row, which means either a sentinel (`"system"`) or a deleted user acting on data. Both warrant investigation.

### 5. Actions by deactivated or missing users

If a user is deactivated (`isActive=false`) and then shows up as the `userId` on a new AuditLog row, either the deactivation didn't close their session or the AuditLog write is stamping the wrong user.

```sql
SELECT
  al."createdAt",
  u.email AS operator_email,
  u."isActive" AS operator_active,
  al."action",
  al."entityType",
  al."entityId"
FROM "AuditLog" al
LEFT JOIN "User" u ON u.id = al."userId"
WHERE (u."isActive" = false OR u.id IS NULL)
  AND al."userId" NOT IN ('system', 'system_webhook')
  AND al."createdAt" > now() - interval '7 days'
ORDER BY al."createdAt" DESC;
```

**Red flags:**
- Any row. The `NOT IN` filter excludes the known sentinels; anything left is either a deactivated user still acting or a dangling `userId` FK (the `AuditLog.userId` column has no DB-level FK — sentinels are expected, but a random cuid that doesn't match a User is not).

### 6. IP distribution (if `ipAddress` is populated)

We do not currently populate `ipAddress` on AuditLog writes (the column exists but is unused). If/when middleware starts capturing it, this query becomes the anomaly detector:

```sql
SELECT
  al."ipAddress",
  COUNT(*) AS actions,
  COUNT(DISTINCT al."userId") AS distinct_users,
  MIN(al."createdAt") AS first_seen,
  MAX(al."createdAt") AS last_seen
FROM "AuditLog" al
WHERE al."createdAt" > now() - interval '7 days'
  AND al."ipAddress" IS NOT NULL
GROUP BY al."ipAddress"
ORDER BY actions DESC
LIMIT 20;
```

**Red flags (future, once populated):**
- A single IP acting as many distinct users in a week — session reuse across accounts.
- A new IP performing a breakglass action — should never happen; breakglass is you from your known environment.

Skip this query for now if the column is empty.

## What to do when a query flags something

1. **Stop scanning.** Don't batch up a list to investigate later — investigate the flagged row now.
2. **Open the runbook for the specific action** if one exists ([stuck-overspend-grants.md](stuck-overspend-grants.md), etc.).
3. **Reconstruct the intent.** Look at the git commit that shipped the feature, recent Slack/email, your own notes. Does the action make sense given what you were doing that day?
4. **If it doesn't:**
   - If you suspect a compromise, rotate credentials immediately — follow [aurora-credential-rotation.md](aurora-credential-rotation.md) and the NextAuth/Stripe webhook secret rotation paths.
   - If you suspect an application bug (e.g., the wrong `userId` stamping), open an issue with the AuditLog row as evidence.
5. **Update this runbook.** If you found a new class of red flag, add it under the relevant query so next week's review catches it faster.

## Past reviews

Append a row after every review. Keep this log in git so it's itself auditable.

| Date | Reviewer | Weeks covered | Flagged rows? | Notes |
|---|---|---|---|---|
| — | — | — | — | First review will be the Monday after this runbook lands |

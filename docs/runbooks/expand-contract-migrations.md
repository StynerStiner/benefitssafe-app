# Expand-Contract Migration Discipline

> Applied reading of BSRS Ch 8 P3 to the BenefitsSafe schema-evolution workflow. Starting with P3a, canary and stable deployments run against the same Aurora writer simultaneously during rollouts. Every schema migration must therefore be forward-compatible with the prior application version.
>
> Companion to [`docs/design-notes/bsrs-ch08-p3-design.md`](../design-notes/bsrs-ch08-p3-design.md) and [`scripts/db/create-aurora-roles.sql`](../../scripts/db/create-aurora-roles.sql).

---

## 1. Why this discipline exists

Pre-P3 BenefitsSafe ran a single production deployment. A migration that renamed or dropped a column was safe because only one code version ever saw the table.

Post-P3 we run **two deployments in parallel** against the same Aurora writer:

- **canary** — 10% of user traffic, lives on `main`, auto-deployed on every merge
- **stable** — 90% of user traffic, lives on `stable`, manually promoted from a burned-in canary

During any rollout window — typically 24 hours, sometimes longer — these two commits are reading and writing the same tables. If the canary migration removes something that stable still depends on, 90% of traffic breaks.

**Example of the failure mode** the discipline avoids:

> A canary migration renames `User.name` → `User.fullName`. Canary code reads `fullName`. Stable still reads `name`. Every `prisma.user.findUnique()` on stable returns rows where `name` is `NULL` because the column has been dropped. 90% of logins break for 24 hours.

The fix is never "deploy faster." It is **"split the schema change into phases where neither side can be broken by the other."**

## 2. Three-phase pattern

| Phase | Schema change | Application code |
|---|---|---|
| **Expand** | Add new structure. Old and new coexist. No destructive DDL. | Old code untouched; new code writes to both and reads from whichever exists. |
| **Migrate** | Backfill + promote new structure to authoritative. | Both deployments read new, dual-write (new + old). |
| **Contract** | Drop old structure. | All code references only new. |

Each phase is **its own deploy** and goes through the 24-hour canary burn-in. A three-phase schema change therefore takes **three canary cycles** minimum (≥72 hours wall clock).

## 3. DDL classification

### Safe — ship in a single phase

These are additive, non-locking, and readable by older code that ignores them.

- `CREATE TABLE foo (...)` — a new table with no references from older code.
- `CREATE INDEX CONCURRENTLY idx_foo_bar ON foo(bar)` — non-blocking.
- `ALTER TABLE foo ADD COLUMN bar TEXT NULL DEFAULT NULL` — nullable, no backfill needed, older code ignores it.
- `CREATE FUNCTION` / `CREATE TRIGGER` on a table only canary-version code references.

### Requires expand (two-phase at minimum)

- `ALTER TABLE foo ADD COLUMN bar TEXT NOT NULL` — cannot land in one phase. Sequence:
  1. Add as nullable with a default.
  2. Backfill existing rows.
  3. `SET NOT NULL` after the backfill completes.
- `ALTER TABLE foo ADD CONSTRAINT c CHECK (...) NOT VALID` → later `ALTER TABLE foo VALIDATE CONSTRAINT c` — two phases so existing rows don't block the deploy.
- `ALTER TABLE foo ADD FOREIGN KEY (...) NOT VALID` → later `VALIDATE CONSTRAINT` — same pattern.

### Requires full three-phase rollout (expand → migrate → contract)

- `ALTER TABLE foo DROP COLUMN bar` — older code still reads it during canary burn-in.
- `ALTER TABLE foo ALTER COLUMN bar TYPE newtype` — older code is compiled against the old type.
- `ALTER TABLE foo RENAME COLUMN` — equivalent to drop + add; always rename by add-new, copy, drop-old.
- `DROP INDEX foo_idx` — query plans on older code may depend on it for acceptable latency.
- `ALTER TYPE enum_foo DROP VALUE 'bar'` — if stable code branches on that value, removing it causes runtime errors.

### Operator review required — never ship without explicit approval

- `TRUNCATE` — irreversible.
- `DROP TABLE` — irreversible. Contract phase only, and only after the column-level contract has burned in for at least a week.
- `ALTER TYPE` that changes storage size / alignment (e.g., `INTEGER` → `BIGINT` on a 100M-row table) — full table rewrite, requires migration window planning.
- Anything that locks a hot table (`LOCK TABLE`, exclusive-lock `ALTER TABLE` variants).

## 4. Worked example — rename `User.name` → `User.fullName`

### Phase 1 — expand (deploy A)

Migration SQL, run under `bs_migrator`:

```sql
ALTER TABLE "User" ADD COLUMN "fullName" TEXT;
UPDATE "User" SET "fullName" = "name" WHERE "fullName" IS NULL;
```

Application code changes:

- **Read path:** `user.fullName ?? user.name` (fall back to old column if new one is unset for some reason).
- **Write path:** write both `fullName` and `name`.
- Prisma schema: add `fullName String?`; keep `name String`.

Commit once. Canary → 24hr burn-in → promote to stable.

### Phase 2 — migrate (deploy B)

Migration SQL:

```sql
ALTER TABLE "User" ALTER COLUMN "fullName" SET NOT NULL;
```

Application code changes:

- **Read path:** `user.fullName` (no fallback).
- **Write path:** still write both `fullName` and `name` — `name` is still present for one more phase.
- Prisma schema: `fullName String` (non-null); `name String` still present.

Commit. Canary → 24hr burn-in → promote.

### Phase 3 — contract (deploy C)

Migration SQL:

```sql
ALTER TABLE "User" DROP COLUMN "name";
```

Application code changes:

- **Write path:** write only `fullName`.
- Prisma schema: remove `name` field.

Commit. Canary → 24hr burn-in → promote.

**Total wall-clock time:** three canary cycles, ≥72 hours. **Total operator effort:** three small commits instead of one big one. This is the price of blast-radius control.

## 5. Rollout checklist (every schema change)

- [ ] Classify the change (safe / expand-only / three-phase / operator-review).
- [ ] Author the migration under `bs_migrator` credentials — CI or operator shell. **Never a Lambda.**
- [ ] Update application code so the current stable version AND the prospective canary version both work against the new schema.
- [ ] Run the migration against staging first. Verify both the current stable build and the prospective canary build pass the test suite.
- [ ] Merge to `main` → auto-deploy to canary.
- [ ] 24hr canary burn-in — monitor `deploy_channel:"canary"` error rate vs stable in Better Stack.
- [ ] If burn-in passes, promote via `promote-canary-to-stable.yml` (lands in P3d).
- [ ] For multi-phase changes: do not start the next phase until the prior one has been on stable for at least 24 hours.

## 6. Emergency bypass

There are cases where forward-compatibility is impossible — e.g., a same-day security fix that requires rewriting a column in place. The bypass sequence:

1. Operator sets canary weight to 0 via the Cloudflare LB API (traffic 100% stable).
2. Operator deploys the breaking migration + code straight to stable (skip the canary burn-in).
3. Verify stable is serving correctly end-to-end.
4. Fast-forward `main` to match `stable`, re-deploy canary, then restore 10/90 weights.

Every bypass must be recorded in the deploy ledger (`docs/runbooks/credential-rotation-history.md`-style log, entry kind `"canary_bypass"`) with the operator ID, timestamp, and reason. Bypasses are expected to be rare; if you are doing more than one per quarter, the discipline is signalling that the canary burn-in window is too slow for the team's deploy cadence — revisit.

Full bypass procedure lives in [`docs/runbooks/failure-domain-failover.md`](./failure-domain-failover.md) (P3e deliverable).

## 7. See also

- [`docs/design-notes/bsrs-ch08-p3-design.md`](../design-notes/bsrs-ch08-p3-design.md) — full P3 design with threat model, architecture, and P-inventory.
- [`scripts/db/create-aurora-roles.sql`](../../scripts/db/create-aurora-roles.sql) — the `bs_migrator` / `bs_stable` / `bs_canary` role topology that makes this discipline enforceable.
- [`docs/design-notes/bsrs-ch08-resilience-applied.md`](../design-notes/bsrs-ch08-resilience-applied.md) — the BSRS Ch 8 applied doc + P-inventory + scorecard.

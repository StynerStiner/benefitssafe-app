---
> **STATUS: NOT YET EXECUTED**
>
> **Trigger to execute:** First real nonprofit onboarded to
> production, OR any evidence the leaked credential has been
> used externally, whichever comes first.
>
> **Why deferred:** Pre-revenue, zero real customer data in
> Aurora. Rotation risk (breaking dev environment during a
> solo-founder build sprint) currently exceeds burn risk.
> When production holds real beneficiary/nonprofit data, this
> math inverts and rotation becomes mandatory.
>
> **Known exposures** (see diagnostic below):
> - docs/monitoring.md (commit 7a10fcc) — committed to git
> - docs/deployment-notes.md (commit 1a31658) — committed to git
> - Conversation context with AI assistants (4 separate sessions)
> - .env and .env.local on developer laptop (mode 0644)
>
> **Do not delete this runbook.** If you find it during cleanup,
> the rotation has not happened yet.
---

# Aurora Credential Rotation Runbook

Status: DRAFT — ready to execute in a dedicated maintenance window.
Owner: adm.benefitssafe@gmail.com (AWS account owner).
Last reviewed: 2026-04-17.

## Why this runbook exists

The Aurora production master credential has been exposed in at least
four distinct channels as of 2026-04-17:

1. Plaintext in two chat/conversation histories on 2026-04-17.
2. `.env.local` on the developer laptop, filesystem permissions `0644`
   (world-readable to any user on that machine).
3. `.env` (same repo), filesystem permissions `0644`, same credential.
4. **Committed to git history** in two tracked files:
   - `docs/monitoring.md` — introduced in commit `7a10fcc`
   - `docs/deployment-notes.md` — introduced in commit `1a31658`

Because git history is distributed and every `git pull` replicates it,
the credential must be considered **permanently burned**. Rotation is
not optional — no amount of file scrubbing or `git filter-branch`
removes credentials that have already been cloned.

This runbook executes that rotation and replaces the single-master
access pattern with a scoped application role.

## Current state (confirmed read-only, 2026-04-17)

| Item | Value |
|---|---|
| DB user the app connects as | `postgres` (RDS master) |
| `rolsuper` | `f` (not a true Postgres superuser) |
| `rolcreaterole` | `t` |
| `rolcreatedb` | `t` |
| `rolcanlogin` | `t` |
| Other non-system roles | `rdsadmin` (AWS-managed, inaccessible), `rdsproxyadmin`, `rdswriteforwarduser` |
| Existing scoped app role | None |
| Tables in `public` | 34 |
| Sequences in `public` | 0 (Prisma uses cuid/uuid strings) |
| Tables with RLS enabled | 0 / 34 |
| Cluster endpoint | `benefitssafe-db.cluster-c9m2ys8y0gk4.us-east-2.rds.amazonaws.com:5432` |
| Database name | `benefitssafe` |

Notes:
- On Aurora, only `rdsadmin` has true `rolsuper=t`. The `postgres`
  master user is the highest-privilege role available to the
  application, and it has broad DDL rights (`CREATE ROLE`, `CREATE
  DATABASE`, all DML + DDL on `public`). This is what we are
  replacing.
- Because 0 tables have RLS enabled, the **only** cross-org isolation
  enforcement today is application-layer `where: { organizationId }`
  filters. The scoped app role does not fix that — it limits blast
  radius if a credential leaks, but does not prevent cross-org reads
  within the app. RLS hardening is a separate runbook.

## Env vars the rotation must update

All references to the production credential:

- `/Users/stynerstiner/Downloads/Projects/benefits-safe-app/.env`
  — `DATABASE_URL` (confirmed hash-match with .env.local).
- `/Users/stynerstiner/Downloads/Projects/benefits-safe-app/.env.local`
  — `DATABASE_URL`, plus commented-out `DATABASE_URL_READONLY`
  pointing at the Aurora proxy read-only endpoint.
- Vercel Production scope (project: benefits-safe-app) —
  `DATABASE_URL`. Verify via `vercel env ls production` before
  rotation.
- Any other `.env*` files: none found.
- Committed-and-burned references (scrub post-rotation for hygiene,
  but the value is already public to anyone with the repo):
  `docs/monitoring.md`, `docs/deployment-notes.md`.

Files in the repo that consume `DATABASE_URL` at runtime (all correct,
no action beyond verification):

| Category | Path |
|---|---|
| prisma-generated | `lib/generated/prisma/internal/class.ts`, `lib/generated/prisma/client.ts` |
| app-config | `lib/db.ts`, `lib/db-read.ts`, `lib/env-validation.ts`, `lib/env-check.ts`, `prisma.config.ts` |
| script (backfill/seed) | `prisma/backfill-membership-codes.ts`, `prisma/backfill-memberships.ts`, `prisma/seed-demo-data.ts`, `prisma/seed-promo-codes.ts`, `prisma/seed.ts` |
| docs (references, no creds) | `CLAUDE.md`, `docs/disaster-recovery.md`, `docs/rollback-procedure.md`, `docs/BENEFITSSAFE-PHASE1-CLAUDE-CODE-PROMPT.md`, `.env.example` |

## Preconditions

- [ ] No Vercel deployment currently in flight (queue empty).
- [ ] No Prisma migration in flight (`prisma migrate status` clean).
- [ ] Aurora automated backup within the last 15 minutes (verify in
      RDS console → Maintenance & backups).
- [ ] Maintenance window declared. Expected app downtime: zero, but
      in-flight DB connections may be terminated at Phase 3.
- [ ] New passwords generated via a password manager — minimum 32
      chars, no shell-meta characters that need URL-encoding surgery
      (`!` became `%21` in the current URL; avoid).
- [ ] AWS Secrets Manager set up to store the NEW master credential
      (it must never go in `.env` or Vercel again).
- [ ] Break-glass access confirmed: IAM user with
      `rds:ModifyDBCluster` permission, in case the psql-based
      rotation fails and we need to use `aws rds
      modify-db-cluster --master-user-password`.

## Phase 0 — Acknowledge the burned credential

The current password is in git history and has been exposed in
multiple channels. Treat any record of it as poisoned. Do not paste
it into new chats, tickets, or docs. After Phase 3 it will no longer
authenticate, but the habit of redacting matters for the next
credential.

## Phase 1 — Create scoped application role

Connect to Aurora **as the current `postgres` master user** (using
the existing credential one last time, before Phase 3 invalidates it):

```sh
psql "$OLD_MASTER_URL"
```

In that session, execute:

```sql
-- Generate with: openssl rand -base64 36 | tr -d '/+=' | head -c 32
-- Store new password in AWS Secrets Manager BEFORE running this.
CREATE ROLE benefitssafe_app LOGIN PASSWORD '<NEW_APP_PASSWORD>';

GRANT CONNECT ON DATABASE benefitssafe TO benefitssafe_app;
GRANT USAGE ON SCHEMA public TO benefitssafe_app;

-- DML on every existing table (34 tables):
GRANT SELECT, INSERT, UPDATE, DELETE
  ON ALL TABLES IN SCHEMA public
  TO benefitssafe_app;

-- Sequences — currently 0 in this DB (Prisma uses cuid/uuid), but
-- future-proof in case a migration adds one:
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO benefitssafe_app;

-- Default privileges so NEW tables/sequences created by future
-- migrations (run as master) are immediately usable by the app role:
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO benefitssafe_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO benefitssafe_app;
```

What we explicitly do NOT grant: `CREATE`, `REFERENCES`, `TRIGGER`,
`TRUNCATE`, `CREATE ROLE`, `CREATE DATABASE`, `SUPERUSER`, any
`pg_read_server_files` / `pg_write_server_files` attributes.

Verification query — run in the same session:

```sql
SELECT rolname, rolsuper, rolcreaterole, rolcreatedb, rolcanlogin
FROM pg_roles WHERE rolname = 'benefitssafe_app';
-- Expect: rolsuper=f, rolcreaterole=f, rolcreatedb=f, rolcanlogin=t
```

Then disconnect and reconnect **as the new app role** to confirm it
works end-to-end:

```sh
psql "postgresql://benefitssafe_app:<NEW_APP_PASSWORD>@<host>:5432/benefitssafe?sslmode=require"
```

```sql
SELECT current_user;                                -- benefitssafe_app
SELECT count(*) FROM "User";                        -- must succeed
INSERT INTO "Notification" (...) VALUES (...);      -- must succeed (pick a harmless row)
CREATE TABLE __scope_test (id int);                 -- must FAIL with permission denied
DROP TABLE "User";                                  -- must FAIL with permission denied
```

If any of the "must FAIL" commands succeed, STOP. The GRANTs leaked
more than intended. Roll back with `DROP ROLE benefitssafe_app;` and
investigate.

## Phase 2 — Update application config to use the scoped role

Build the new connection string:

```
postgresql://benefitssafe_app:<NEW_APP_PASSWORD_URLENCODED>@benefitssafe-db.cluster-c9m2ys8y0gk4.us-east-2.rds.amazonaws.com:5432/benefitssafe?sslmode=require
```

URL-encode any special characters in the password. Prefer a password
with no shell-meta/URL-meta characters so this step is trivial.

1. Update Vercel (Production scope) first:
   ```sh
   vercel env rm DATABASE_URL production
   vercel env add DATABASE_URL production   # paste new value
   ```
2. Trigger a Vercel production deploy (manual, per project
   convention): `vercel --prod` from the project root.
3. After Vercel reports the deploy is live and health checks pass,
   update the developer laptop:
   - `.env.local` — replace `DATABASE_URL`.
   - `.env` — replace `DATABASE_URL` (currently duplicates the same
     value).
   - `chmod 600 .env .env.local` (they are currently `0644`).

## Phase 3 — Rotate the master password

**Preferred path (works while the old password is still valid):**

In a fresh psql session authenticated as `postgres`:

```sql
ALTER ROLE postgres PASSWORD '<NEW_MASTER_PASSWORD>';
```

**Fallback path (if the old password is already being blocked):**

```sh
aws rds modify-db-cluster \
  --db-cluster-identifier benefitssafe-db \
  --master-user-password '<NEW_MASTER_PASSWORD>' \
  --apply-immediately \
  --region us-east-2
```

Store `<NEW_MASTER_PASSWORD>` in **AWS Secrets Manager only**:

- Secret name: `benefitssafe/aurora/master`
- Tags: `env=prod`, `use=break-glass-and-migrations`
- Do NOT write it to `.env`, `.env.local`, Vercel, chat, notes, or
  any repo file.

## Phase 4 — Separate migration credentials from runtime credentials

Prisma migrations need `CREATE / ALTER / DROP` — the app role does
not have those. Split the URLs:

- `DATABASE_URL` (Vercel + `.env.local`): points at
  `benefitssafe_app` role. Used by the running app.
- `DATABASE_MIGRATE_URL` (laptop only, sourced on-demand from AWS
  Secrets Manager): points at `postgres` master. Used only when
  running `prisma migrate deploy` from a developer machine.

Never put `DATABASE_MIGRATE_URL` in Vercel. Never put the master
password in any `.env*` file at rest — fetch it into the shell with
`aws secretsmanager get-secret-value` at migration time and let it
fall out of shell history.

Update migration tooling so local migration runs read from the secret
rather than expecting a long-lived env var. Suggested wrapper:

```sh
export DATABASE_URL="$(aws secretsmanager get-secret-value \
  --secret-id benefitssafe/aurora/master \
  --query SecretString --output text)"
npx prisma migrate deploy
unset DATABASE_URL
```

## Phase 5 — Verification checklist

- [ ] Vercel production runtime logs show `current_user =
      benefitssafe_app` on the next DB query (temporarily add a
      `SELECT current_user` probe to a non-critical endpoint if no
      existing log line reveals this).
- [ ] Login flow end-to-end on production.
- [ ] Dashboard loads for a test org — representative SELECT paths.
- [ ] Webhook handler processes a Stripe test event — representative
      INSERT path.
- [ ] Intentional negative test: from an ad-hoc psql as
      `benefitssafe_app`, `DROP TABLE "User"` returns
      `permission denied`.
- [ ] `prisma migrate deploy` still works from the developer laptop
      using the `DATABASE_MIGRATE_URL` sourced from Secrets Manager.

## Phase 6 — Post-rotation hygiene

- [ ] Scrub the burned password from the tracked docs so new clones
      don't surface it in editor search. This does NOT remove it
      from git history — the exposure is permanent — but it prevents
      fresh eyes from re-copying a dead credential into a new
      context:
      - `docs/monitoring.md` (3 occurrences in commit `7a10fcc`)
      - `docs/deployment-notes.md` (2 occurrences in commit
        `1a31658`)
- [ ] Commit the scrubs in a message that does NOT repeat the
      credential.
- [ ] Add a pre-commit hook or gitleaks/detect-secrets scan to
      prevent recurrence.
- [ ] File permissions: confirm `.env` and `.env.local` are `0600`.
- [ ] Add `.env` and `.env.local` to the local encrypted backup
      routine (or document why they're excluded).
- [ ] Revisit any ticket, screenshot, or chat export that may carry
      the old credential. Treat those artifacts as sensitive even
      though the credential no longer authenticates.

## Rollback

If Phase 2 breaks the app (new credential rejected, scope too
narrow, connection string malformed):

- The old `postgres` master credential still works **until Phase 3
  completes**. Pasting it back into Vercel restores service.
- After Phase 3, rollback is via the AWS RDS console / `aws rds
  modify-db-cluster --master-user-password` to set a known value,
  then repeat from Phase 2.
- `benefitssafe_app` role itself can be dropped safely:
  ```sql
  REASSIGN OWNED BY benefitssafe_app TO postgres;  -- should be no-op, app role owns nothing
  DROP OWNED BY benefitssafe_app;
  DROP ROLE benefitssafe_app;
  ```

## Out of scope for this runbook (separate work)

- RLS policies on all 34 tables (currently 0 / 34).
- Cross-org query audit (separate PDR — item B in tonight's plan).
- Webhook idempotency wiring verification (separate PDR — item D).
- Read-replica credential (`DATABASE_URL_READONLY`, currently
  commented out): if re-enabled, create a `benefitssafe_app_ro` role
  with only `SELECT` + `USAGE` and use that instead of reusing the
  app role.

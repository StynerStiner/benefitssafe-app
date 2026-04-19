-- BSRS Ch 8 P3a — Aurora role separation for failure domains.
--
-- Creates three disjoint login roles against the BenefitsSafe Aurora
-- writer cluster:
--
--   bs_migrator  — DDL + DML. Held by CI or operator during schema
--                  migrations. No Lambda ever uses this role.
--   bs_stable    — DML only. Held by the stable deployment at
--                  production runtime. Immutable-ledger tables
--                  denied UPDATE + DELETE.
--   bs_canary    — DML only, plus a trigger that blocks privilege-
--                  escalation inserts/updates on OrganizationMembership.
--                  Held by the canary deployment at production runtime.
--
-- This script is idempotent. Re-running is safe; role-exists checks
-- skip conflicting CREATEs. Passwords are psql variable placeholders —
-- operator substitutes the real values from AWS Secrets Manager before
-- execution.
--
-- Execution (operator-only, against the Aurora writer):
--   psql "$AURORA_ADMIN_URL" \
--     -v bs_migrator_password="'<from Secrets Manager>'" \
--     -v bs_stable_password="'<from Secrets Manager>'" \
--     -v bs_canary_password="'<from Secrets Manager>'" \
--     -f scripts/db/create-aurora-roles.sql
--
-- After execution, run the verification queries in section 7 to
-- confirm the role topology is correct. See
-- docs/design-notes/bsrs-ch08-p3-design.md §5 for the threat model
-- this separation addresses and docs/runbooks/expand-contract-
-- migrations.md for the companion schema-change discipline.

\set ON_ERROR_STOP on

-- ────────────────────────────────────────────────────────────────────
-- 1. Role creation (idempotent)
-- ────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bs_migrator') THEN
    EXECUTE format('CREATE ROLE bs_migrator LOGIN PASSWORD %L',
                   :'bs_migrator_password');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bs_stable') THEN
    EXECUTE format('CREATE ROLE bs_stable LOGIN PASSWORD %L',
                   :'bs_stable_password');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bs_canary') THEN
    EXECUTE format('CREATE ROLE bs_canary LOGIN PASSWORD %L',
                   :'bs_canary_password');
  END IF;
END
$$;

-- ────────────────────────────────────────────────────────────────────
-- 2. Database + schema connect permissions
-- ────────────────────────────────────────────────────────────────────
-- Adjust the database name below if the cluster uses something other
-- than "benefitssafe". The AWS-default is usually the db_name set at
-- RDS creation time.

GRANT CONNECT ON DATABASE benefitssafe TO bs_migrator, bs_stable, bs_canary;
GRANT USAGE   ON SCHEMA   public       TO bs_migrator, bs_stable, bs_canary;

-- ────────────────────────────────────────────────────────────────────
-- 3. bs_migrator — DDL + full DML (for schema migrations only)
-- ────────────────────────────────────────────────────────────────────

GRANT CREATE ON SCHEMA public TO bs_migrator;
GRANT ALL PRIVILEGES ON ALL TABLES    IN SCHEMA public TO bs_migrator;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO bs_migrator;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL PRIVILEGES ON TABLES    TO bs_migrator;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL PRIVILEGES ON SEQUENCES TO bs_migrator;

-- ────────────────────────────────────────────────────────────────────
-- 4. bs_stable + bs_canary — DML on all current + future tables
-- ────────────────────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE
  ON ALL TABLES IN SCHEMA public TO bs_stable, bs_canary;
GRANT USAGE, SELECT
  ON ALL SEQUENCES IN SCHEMA public TO bs_stable, bs_canary;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES    TO bs_stable, bs_canary;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT                  ON SEQUENCES TO bs_stable, bs_canary;

-- ────────────────────────────────────────────────────────────────────
-- 5. Immutable-ledger invariants — revoke UPDATE + DELETE
-- ────────────────────────────────────────────────────────────────────
-- LedgerEntry, AuditLog, and ProcessedWebhookEvent are append-only
-- by design. Prior to P3a this was enforced by convention only. The
-- REVOKEs below move the invariant into the DB so a buggy route, a
-- compromised Lambda, or a malicious insider with Lambda credentials
-- cannot mutate or delete historical records.

REVOKE UPDATE, DELETE ON "LedgerEntry"            FROM bs_stable, bs_canary;
REVOKE UPDATE, DELETE ON "AuditLog"               FROM bs_stable, bs_canary;
REVOKE UPDATE, DELETE ON "ProcessedWebhookEvent"  FROM bs_stable, bs_canary;

-- ────────────────────────────────────────────────────────────────────
-- 6. Canary privilege-escalation guard (OrganizationMembership)
-- ────────────────────────────────────────────────────────────────────
-- Trigger-enforced: bs_canary CANNOT insert or update an
-- OrganizationMembership row whose role is in the privileged set
-- (platform_admin, compliance_officer, billing_admin, support_agent).
-- A compromised canary Lambda or a buggy canary deploy therefore
-- cannot mint platform-admin memberships.
--
-- Scope: OrganizationMembership only. User.role is a separate
-- privilege-bearing column that is deferred to P3b — see
-- docs/design-notes/bsrs-ch08-p3-design.md §12 OQ-9.

CREATE OR REPLACE FUNCTION bs_canary_membership_guard()
RETURNS trigger AS $fn$
BEGIN
  IF current_user = 'bs_canary' AND NEW.role IN (
    'platform_admin',
    'compliance_officer',
    'billing_admin',
    'support_agent'
  ) THEN
    RAISE EXCEPTION
      'bs_canary cannot create or mutate privileged OrganizationMembership '
      '(attempted role=%). This is a BSRS Ch 8 P3 blast-radius control.',
      NEW.role
    USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS bs_canary_membership_guard_trg
  ON "OrganizationMembership";
CREATE TRIGGER bs_canary_membership_guard_trg
  BEFORE INSERT OR UPDATE ON "OrganizationMembership"
  FOR EACH ROW EXECUTE FUNCTION bs_canary_membership_guard();

-- ────────────────────────────────────────────────────────────────────
-- 7. Verification queries
-- ────────────────────────────────────────────────────────────────────
-- Run these after the script to confirm the role topology is as
-- expected. Each query has a comment describing the correct result.

-- (7a) Expected: three rows — bs_migrator, bs_stable, bs_canary — all
-- with rolcanlogin=true and rolsuper=false.
SELECT rolname, rolcanlogin, rolsuper, rolcreatedb, rolcreaterole
FROM pg_roles
WHERE rolname IN ('bs_migrator', 'bs_stable', 'bs_canary')
ORDER BY rolname;

-- (7b) Expected: bs_stable and bs_canary have SELECT + INSERT on each
-- immutable table but NOT UPDATE or DELETE. bs_migrator (not shown
-- here) has all four.
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_name IN ('LedgerEntry', 'AuditLog', 'ProcessedWebhookEvent')
  AND grantee IN ('bs_stable', 'bs_canary')
ORDER BY grantee, table_name, privilege_type;

-- (7c) Expected: one row — bs_canary_membership_guard_trg firing
-- BEFORE INSERT OR UPDATE on OrganizationMembership.
SELECT trigger_name, event_manipulation, event_object_table, action_timing
FROM information_schema.triggers
WHERE trigger_name = 'bs_canary_membership_guard_trg'
ORDER BY event_manipulation;

-- (7d) Trigger fires end-to-end check. Must be run manually — it is
-- commented out here to avoid side effects during the standard script
-- execution. Expected: the INSERT raises ERRCODE 42501 and the
-- transaction rolls back cleanly.
--
-- BEGIN;
-- SET LOCAL ROLE bs_canary;
-- INSERT INTO "OrganizationMembership"
--   (id, "userId", "organizationId", role, status)
-- VALUES
--   (gen_random_uuid(), 'test-user', 'test-org', 'platform_admin', 'active');
-- -- Expect: ERROR  42501: bs_canary cannot create or mutate privileged ...
-- ROLLBACK;

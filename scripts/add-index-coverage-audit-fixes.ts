// DDIA Ch3 — Index Coverage Audit migration.
//
// This script applies every index change declared in prisma/schema.prisma
// after the April 14, 2026 audit: adds 7 new composites and drops 26
// redundant indexes. Read the audit log for full context:
//
//   references/engineering/designing-data-intensive-applications/AUDIT-TRACKER.md
//
// Safety properties:
//   - CREATE INDEX CONCURRENTLY — does not lock the table, so it is safe
//     on hot production tables. Cannot run inside a transaction; we use
//     $executeRawUnsafe which sends each statement individually.
//   - DROP INDEX CONCURRENTLY — same. A failed drop does NOT abort the
//     run, so each drop is independent.
//   - IF NOT EXISTS / IF EXISTS — every statement is idempotent. Re-running
//     the script on a partially-applied state is safe.
//
// Caveats:
//   - CREATE INDEX CONCURRENTLY takes minutes to hours on 100M+ row tables.
//     Expect the full run to take 30+ minutes at full scale.
//   - Prisma's default index naming is "<Model>_<col1>_<col2>_..._idx".
//     Older migrations or hand-written scripts may have created indexes
//     under different names. The pg_indexes dump at the top shows every
//     name actually present so the operator can spot any outliers.
//
// Usage (from benefits-safe-app/):
//
//   npx tsx scripts/add-index-coverage-audit-fixes.ts
//
// You can re-run it at any time — it converges on the target state.

import { prisma } from "../lib/db";

interface IndexRow {
  tablename: string;
  indexname: string;
  indexdef: string;
}

const NEW_INDEXES: Array<{ name: string; sql: string; rationale: string }> = [
  {
    name: "ExpenseRequest_organizationId_riskClassification_idx",
    sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS "ExpenseRequest_organizationId_riskClassification_idx" ON "ExpenseRequest" ("organizationId", "riskClassification")`,
    rationale: "/compliance page did 4 unindexed count() calls per render",
  },
  {
    name: "Notification_userId_organizationId_createdAt_idx",
    sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS "Notification_userId_organizationId_createdAt_idx" ON "Notification" ("userId", "organizationId", "createdAt")`,
    rationale: "Dashboard notification poll — 300M-row table had no leftmost-prefix cover",
  },
  {
    name: "Grant_organizationId_createdAt_idx",
    sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS "Grant_organizationId_createdAt_idx" ON "Grant" ("organizationId", "createdAt")`,
    rationale: "Paginated grants list sorted by recency",
  },
  {
    name: "VirtualCard_organizationId_createdAt_idx",
    sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS "VirtualCard_organizationId_createdAt_idx" ON "VirtualCard" ("organizationId", "createdAt")`,
    rationale: "Paginated cards list sorted by recency",
  },
  {
    name: "Vendor_organizationId_createdAt_idx",
    sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS "Vendor_organizationId_createdAt_idx" ON "Vendor" ("organizationId", "createdAt")`,
    rationale: "Paginated vendors list sorted by recency",
  },
  {
    name: "CalendarEvent_organizationId_startDate_idx",
    sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS "CalendarEvent_organizationId_startDate_idx" ON "CalendarEvent" ("organizationId", "startDate")`,
    rationale: "Calendar range queries per org",
  },
  {
    name: "OrganizationMembership_organizationId_status_role_idx",
    sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS "OrganizationMembership_organizationId_status_role_idx" ON "OrganizationMembership" ("organizationId", "status", "role")`,
    rationale: "Reorder of [organizationId, role, status] — users route filters by status always, role only sometimes",
  },
];

// Drops are listed with every plausible Prisma/legacy name so the script is
// robust to older migrations that may have used different naming. Each DROP
// is idempotent via IF EXISTS — extra names are silent no-ops.
const DROP_INDEXES: Array<{ label: string; names: string[] }> = [
  // ExpenseRequest — 5 drops
  { label: "ExpenseRequest.[organizationId]", names: ["ExpenseRequest_organizationId_idx"] },
  { label: "ExpenseRequest.[organizationId, status]", names: ["ExpenseRequest_organizationId_status_idx"] },
  { label: "ExpenseRequest.[status]", names: ["ExpenseRequest_status_idx"] },
  { label: "ExpenseRequest.[requestedById]", names: ["ExpenseRequest_requestedById_idx"] },
  { label: "ExpenseRequest.[grantId, status]", names: ["ExpenseRequest_grantId_status_idx"] },
  // Grant — 1 drop
  { label: "Grant.[organizationId]", names: ["Grant_organizationId_idx"] },
  // Vendor — 1 drop
  { label: "Vendor.[organizationId]", names: ["Vendor_organizationId_idx"] },
  // Subscription — 2 drops
  { label: "Subscription.[vendorId]", names: ["Subscription_vendorId_idx"] },
  { label: "Subscription.[grantId]", names: ["Subscription_grantId_idx"] },
  // VirtualCard — 2 drops
  { label: "VirtualCard.[organizationId]", names: ["VirtualCard_organizationId_idx"] },
  { label: "VirtualCard.[stripeCardId]", names: ["VirtualCard_stripeCardId_idx"] },
  // CardholderEligibility — 1 drop
  { label: "CardholderEligibility.[beneficiaryId]", names: ["CardholderEligibility_beneficiaryId_idx"] },
  // Transaction — 2 drops
  { label: "Transaction.[cardId]", names: ["Transaction_cardId_idx"] },
  { label: "Transaction.[organizationId]", names: ["Transaction_organizationId_idx"] },
  // LedgerEntry — 2 drops
  { label: "LedgerEntry.[organizationId]", names: ["LedgerEntry_organizationId_idx"] },
  { label: "LedgerEntry.[grantId]", names: ["LedgerEntry_grantId_idx"] },
  // AuditLog — 1 drop
  { label: "AuditLog.[organizationId]", names: ["AuditLog_organizationId_idx"] },
  // InviteToken — 1 drop (duplicate of @unique)
  { label: "InviteToken.[token]", names: ["InviteToken_token_idx"] },
  // PromoCode — 1 drop (duplicate of @unique)
  { label: "PromoCode.[code]", names: ["PromoCode_code_idx"] },
  // CronCheckpoint — 1 drop (duplicate of @unique)
  { label: "CronCheckpoint.[cronName]", names: ["CronCheckpoint_cronName_idx"] },
  // BillingSubscription — 1 drop (duplicate of @unique)
  { label: "BillingSubscription.[organizationId]", names: ["BillingSubscription_organizationId_idx"] },
  // Integration — 1 drop (subsumed by (organizationId, provider) @unique)
  { label: "Integration.[organizationId]", names: ["Integration_organizationId_idx"] },
  // UsageCounter — 1 drop (subsumed by (organizationId, period) @unique)
  { label: "UsageCounter.[organizationId]", names: ["UsageCounter_organizationId_idx"] },
  // OrganizationMembership — 3 drops (including the reordered composite)
  { label: "OrganizationMembership.[userId]", names: ["OrganizationMembership_userId_idx"] },
  { label: "OrganizationMembership.[organizationId]", names: ["OrganizationMembership_organizationId_idx"] },
  {
    label: "OrganizationMembership.[organizationId, role, status] (replaced by reordered)",
    // Both the Prisma-default and the legacy hand-abbreviated name (from
    // scripts/add-membership-composite-index.ts) — drop whichever is present.
    names: [
      "OrganizationMembership_organizationId_role_status_idx",
      "OrganizationMembership_orgId_role_status_idx",
    ],
  },
];

async function dumpIndexes(label: string): Promise<void> {
  const rows = await prisma.$queryRawUnsafe<IndexRow[]>(`
    SELECT tablename, indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename IN (
        'ExpenseRequest','Grant','Vendor','Subscription','VirtualCard',
        'CardholderEligibility','Transaction','LedgerEntry','AuditLog',
        'Notification','CalendarEvent','OrganizationMembership',
        'InviteToken','PromoCode','CronCheckpoint','BillingSubscription',
        'Integration','UsageCounter'
      )
    ORDER BY tablename, indexname;
  `);
  console.log(`\n=== ${label} (${rows.length} indexes across audited tables) ===`);
  for (const row of rows) {
    console.log(`  ${row.tablename.padEnd(28)} ${row.indexname}`);
  }
}

async function main() {
  console.log("BenefitsSafe — DDIA Ch3 Index Coverage Audit migration");
  console.log("--------------------------------------------------------");

  await dumpIndexes("BEFORE");

  console.log(`\n=== Creating ${NEW_INDEXES.length} new indexes ===`);
  for (const idx of NEW_INDEXES) {
    const start = Date.now();
    try {
      console.log(`  CREATE ${idx.name}`);
      console.log(`    → ${idx.rationale}`);
      await prisma.$executeRawUnsafe(idx.sql);
      console.log(`    ✓ done in ${Math.round((Date.now() - start) / 1000)}s`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`    ✗ FAILED: ${message}`);
    }
  }

  console.log(`\n=== Dropping ${DROP_INDEXES.length} redundant indexes ===`);
  for (const drop of DROP_INDEXES) {
    console.log(`  DROP ${drop.label}`);
    for (const name of drop.names) {
      try {
        await prisma.$executeRawUnsafe(
          `DROP INDEX CONCURRENTLY IF EXISTS "${name}"`,
        );
        console.log(`    ✓ ${name}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`    ✗ ${name}: ${message}`);
      }
    }
  }

  await dumpIndexes("AFTER");

  console.log("\nDone. Review the AFTER dump — every expected new index should");
  console.log("be present, and every dropped index should be absent.");
}

main()
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

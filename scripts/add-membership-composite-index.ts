// Adds a composite index on OrganizationMembership(organizationId, role, status)
// — the exact filter shape the multi-org list endpoints hit on every request:
//
//   prisma.organizationMembership.findMany({
//     where: { organizationId, role: "beneficiary", status: "active" },
//   })
//
// At 1.8M nonprofits × ~500 members/org = 900M rows, the existing
// @@index([organizationId]) alone forces a scan of every membership in
// the org and an in-app filter. The new composite makes the lookup an
// indexed range read and is the single biggest perf win for the
// multi-org refactor.
//
// CREATE INDEX CONCURRENTLY runs without locking the table — safe to
// apply on a hot prod DB. Cannot run inside a Postgres transaction, so
// we use $executeRawUnsafe which sends the statement raw.

import { prisma } from "../lib/db";

async function main() {
  console.log("Creating composite index (CONCURRENTLY) — may take a while at scale…");
  await prisma.$executeRawUnsafe(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS
      "OrganizationMembership_orgId_role_status_idx"
    ON "OrganizationMembership" ("organizationId", "role", "status");
  `);
  console.log("Index created.");

  const indexes = await prisma.$queryRawUnsafe<
    Array<{ indexname: string; indexdef: string }>
  >(`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'OrganizationMembership'
    ORDER BY indexname;
  `);
  console.table(indexes);
}

main().finally(() => prisma.$disconnect());

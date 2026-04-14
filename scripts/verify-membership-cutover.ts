// Pre-cutover verification: every nonprofit-side User must have a matching
// OrganizationMembership(user.id, user.organizationId, role=user.role).
// Any orphan would silently disappear from the new membership-based list
// queries after the multi-org cutover.

import { prisma } from "../lib/db";

async function main() {
  console.log("\n=== Orphaned beneficiaries/vendors/staff (User without matching membership) ===");
  const orphans = await prisma.$queryRawUnsafe<
    Array<{ id: string; email: string; role: string; organizationId: string }>
  >(`
    SELECT u.id, u.email, u.role::text as role, u."organizationId"
    FROM "User" u
    WHERE u.role IN ('beneficiary','vendor','nonprofit_staff','nonprofit_admin','cpa','auditor','attorney','grant_officer')
      AND NOT EXISTS (
        SELECT 1 FROM "OrganizationMembership" om
        WHERE om."userId" = u.id
          AND om."organizationId" = u."organizationId"
      )
    LIMIT 50;
  `);
  console.table(orphans);
  console.log(`Orphan rows: ${orphans.length}`);

  console.log("\n=== Memberships with stale role (membership.role != user.role) ===");
  const drift = await prisma.$queryRawUnsafe<
    Array<{ email: string; user_role: string; mem_role: string; orgCode: string | null }>
  >(`
    SELECT u.email, u.role::text as user_role, om.role as mem_role, o."orgCode"
    FROM "User" u
    JOIN "OrganizationMembership" om ON om."userId" = u.id AND om."organizationId" = u."organizationId"
    JOIN "Organization" o ON o.id = om."organizationId"
    WHERE u.role::text != om.role
      AND u.role IN ('beneficiary','vendor','nonprofit_staff','nonprofit_admin','cpa','auditor','attorney','grant_officer')
    LIMIT 50;
  `);
  console.table(drift);
  console.log(`Drift rows: ${drift.length}`);

  console.log("\n=== Membership status distribution per role ===");
  const dist = await prisma.$queryRawUnsafe<
    Array<{ role: string; status: string; n: bigint }>
  >(`
    SELECT om.role, om.status, COUNT(*)::bigint as n
    FROM "OrganizationMembership" om
    GROUP BY om.role, om.status
    ORDER BY om.role, om.status;
  `);
  console.table(dist.map(d => ({ ...d, n: Number(d.n) })));
}

main().finally(() => prisma.$disconnect());

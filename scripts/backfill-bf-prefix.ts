import { prisma } from "../lib/db";

async function main() {
  const updated = await prisma.$executeRawUnsafe(`
    UPDATE "OrganizationMembership"
    SET "memberCode" = REPLACE("memberCode", 'TM-', 'BF-')
    WHERE "userId" IN (
      SELECT id FROM "User"
      WHERE role IN ('platform_admin','compliance_officer','support_agent','billing_admin')
    )
    AND "memberCode" LIKE 'TM-%';
  `);
  console.log(`Rows updated: ${updated}`);

  const rows = await prisma.$queryRawUnsafe<
    Array<{ email: string; role: string; memberCode: string | null }>
  >(`
    SELECT u.email, u.role::text as role, om."memberCode"
    FROM "User" u
    JOIN "OrganizationMembership" om ON om."userId" = u.id
    WHERE u.role IN ('platform_admin','compliance_officer','support_agent','billing_admin')
    ORDER BY u.role;
  `);
  console.table(rows);
}

main().finally(() => prisma.$disconnect());

import { prisma } from "../lib/db";

async function main() {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "is_platform_org" BOOLEAN DEFAULT false;`
  );
  await prisma.$executeRawUnsafe(
    `UPDATE "Organization" SET "is_platform_org" = true WHERE "orgCode" = 'ORG-00001';`
  );
  const rows = await prisma.$queryRawUnsafe<
    Array<{ id: string; name: string; orgCode: string | null; is_platform_org: boolean }>
  >(`SELECT id, name, "orgCode", is_platform_org FROM "Organization" ORDER BY "orgCode";`);
  console.table(rows);
}

main().finally(() => prisma.$disconnect());

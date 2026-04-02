// Backfill OrganizationMembership records from existing User.organizationId
// Run with: npx tsx prisma/backfill-memberships.ts
//
// This script uses the PrismaPg adapter since the datasource has no url field.
// Ensure DATABASE_URL is set in .env.local before running.

import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set. Add it to .env.local.");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter }) as PrismaClient;

async function main() {
  const users = await prisma.user.findMany({
    where: { organizationId: { not: undefined } },
    select: { id: true, organizationId: true, role: true },
  });

  console.log(`Found ${users.length} users to backfill memberships for.`);

  let created = 0;
  let skipped = 0;

  for (const user of users) {
    if (!user.organizationId) continue;

    const existing = await prisma.organizationMembership.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: user.organizationId,
        },
      },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.organizationMembership.create({
      data: {
        userId: user.id,
        organizationId: user.organizationId,
        role: user.role || "member",
        status: "active",
        isDefaultOrg: true,
        joinedAt: new Date(),
      },
    });
    created++;
  }

  console.log(`Backfill complete. Created: ${created}, Skipped: ${skipped}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

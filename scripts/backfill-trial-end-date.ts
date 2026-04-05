import { prisma } from "../lib/db";

async function main() {
  const orgs = await prisma.organization.findMany({
    where: { trialEndDate: null },
    select: { id: true, name: true, createdAt: true },
  });

  console.log(`Found ${orgs.length} orgs without trialEndDate`);

  const now = new Date();
  for (const org of orgs) {
    // Trial = 14 days from createdAt, OR 14 days from now if createdAt is in the past
    const baseDate = org.createdAt > now ? org.createdAt : now;
    const trialEnd = new Date(baseDate.getTime() + 14 * 24 * 60 * 60 * 1000);

    await prisma.organization.update({
      where: { id: org.id },
      data: {
        trialEndDate: trialEnd,
        subscriptionStatus: "trial",
      },
    });

    console.log(`  [${org.name}] trialEndDate set to ${trialEnd.toISOString()}`);
  }

  console.log("Done.");
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });

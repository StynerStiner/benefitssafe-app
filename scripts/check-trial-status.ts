import { prisma } from "../lib/db";

async function main() {
  const orgs = await prisma.organization.findMany({
    select: {
      id: true,
      name: true,
      subscriptionStatus: true,
      trialEndDate: true,
      billingSubscription: {
        select: { tier: true, status: true, currentPeriodEnd: true },
      },
    },
  });
  const now = new Date();
  console.log("Now:", now.toISOString());
  console.log("");
  for (const o of orgs) {
    const expired = o.trialEndDate ? o.trialEndDate < now : true;
    console.log(`[${o.name}] (${o.id})`);
    console.log(`  subscriptionStatus: ${o.subscriptionStatus}`);
    console.log(`  trialEndDate: ${o.trialEndDate?.toISOString() || "NULL"}`);
    console.log(`  trialExpired: ${expired}`);
    console.log(`  billingSub: ${o.billingSubscription ? `${o.billingSubscription.tier}/${o.billingSubscription.status}` : "NONE"}`);
    console.log("");
  }
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });

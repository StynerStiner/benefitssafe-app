import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";

// Load env vars for seed script (runs outside Next.js)
config({ path: ".env.local" });

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter }) as PrismaClient;

interface PromoCodeSeed {
  code: string;
  description: string;
  trialDays: number;
  maxUses: number;
}

const DEFAULT_PROMO_CODES: PromoCodeSeed[] = [
  {
    code: "BETA2026",
    description: "Beta program -- 6 months free access for early adopters",
    trialDays: 180,
    maxUses: 100,
  },
  {
    code: "EARLYBIRD",
    description: "Early bird offer -- 1 year free access",
    trialDays: 365,
    maxUses: 50,
  },
  {
    code: "PARTNER2026",
    description: "Partner program -- 1 year free access for strategic partners",
    trialDays: 365,
    maxUses: 25,
  },
];

async function main() {
  console.log("Seeding promo codes...");

  // Find a platform_admin to attribute code creation to.
  // Falls back to "system" if no platform_admin exists yet.
  const platformAdmin = await prisma.user.findFirst({
    where: { role: "platform_admin" },
    select: { id: true },
  });

  const createdById = platformAdmin?.id || "system";

  for (const seed of DEFAULT_PROMO_CODES) {
    const existing = await prisma.promoCode.findUnique({
      where: { code: seed.code },
      select: { id: true },
    });

    if (existing) {
      console.log(`  Promo code ${seed.code} already exists -- skipping`);
      continue;
    }

    const created = await prisma.promoCode.create({
      data: {
        code: seed.code,
        description: seed.description,
        trialDays: seed.trialDays,
        maxUses: seed.maxUses,
        createdById,
        isActive: true,
      },
    });

    console.log(
      `  Created promo code: ${created.code} (${created.trialDays} days, max ${created.maxUses} uses)`,
    );
  }

  console.log("\nPromo code seed complete!");
}

main()
  .catch((e) => {
    console.error("Promo code seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { config } from "dotenv";

// Load env vars for seed script (runs outside Next.js)
config({ path: ".env.local" });

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter }) as PrismaClient;

async function main() {
  console.log("Seeding database...");

  // Create a test organization
  const org = await prisma.organization.upsert({
    where: { id: "org-test-001" },
    update: {},
    create: {
      id: "org-test-001",
      name: "Test Nonprofit Organization",
      ein: "12-3456789",
      address: "123 Grant Street, San Francisco, CA 94102",
      phone: "(415) 555-0100",
      website: "https://test-nonprofit.org",
    },
  });

  // Create a platform org for platform-level roles
  const platformOrg = await prisma.organization.upsert({
    where: { id: "org-platform-001" },
    update: {},
    create: {
      id: "org-platform-001",
      name: "BenefitsSafe Platform",
    },
  });

  console.log(`Created organization: ${org.name}`);
  console.log(`Created organization: ${platformOrg.name}`);

  // Password for all test users: Test1234!
  const passwordHash = await bcrypt.hash("Test1234!", 12);

  // Create test users for all roles
  const users = [
    // --- Nonprofit org roles ---
    {
      id: "user-admin-001",
      email: "admin@benefits-safe.test",
      firstName: "Sarah",
      lastName: "Mitchell",
      phone: "(415) 555-0101",
      role: "nonprofit_admin" as const,
      organizationId: org.id,
    },
    {
      id: "user-staff-001",
      email: "staff@benefits-safe.test",
      firstName: "Jordan",
      lastName: "Lee",
      phone: "(415) 555-0106",
      role: "nonprofit_staff" as const,
      organizationId: org.id,
    },
    {
      id: "user-beneficiary-001",
      email: "beneficiary@benefits-safe.test",
      firstName: "James",
      lastName: "Carter",
      phone: "(510) 555-0142",
      role: "beneficiary" as const,
      organizationId: org.id,
      dateOfBirth: new Date("1985-06-15"),
      addressStreet: "1234 Oak Street",
      addressCity: "Oakland",
      addressState: "CA",
      addressZip: "94607",
      benefitPrograms: { ssi: true, ssdi: false, mediCal: true, medicaid: false, able: false, calFresh: false, ihss: false },
      emergencyContactName: "Lisa Carter",
      emergencyContactPhone: "(510) 555-0143",
      notes: "Referred by East Bay Community Services. Receives SSI and Medi-Cal. Active grant recipient for creative writing fellowship.",
    },
    {
      id: "user-cpa-001",
      email: "cpa@benefits-safe.test",
      firstName: "Maria",
      lastName: "Rodriguez",
      role: "cpa" as const,
      organizationId: org.id,
    },
    {
      id: "user-auditor-001",
      email: "auditor@benefits-safe.test",
      firstName: "David",
      lastName: "Chen",
      role: "auditor" as const,
      organizationId: org.id,
    },
    {
      id: "user-vendor-001",
      email: "vendor@benefits-safe.test",
      firstName: "Alex",
      lastName: "Thompson",
      role: "vendor" as const,
      organizationId: org.id,
    },
    {
      id: "user-attorney-001",
      email: "attorney@benefits-safe.test",
      firstName: "Rachel",
      lastName: "Kim",
      role: "attorney" as const,
      organizationId: org.id,
    },
    {
      id: "user-grant-officer-001",
      email: "grant.officer@benefits-safe.test",
      firstName: "Michael",
      lastName: "Torres",
      role: "grant_officer" as const,
      organizationId: org.id,
    },
    // --- Platform roles ---
    {
      id: "user-platform-001",
      email: "platform@benefits-safe.test",
      firstName: "Pat",
      lastName: "Williams",
      role: "platform_admin" as const,
      organizationId: platformOrg.id,
    },
    {
      id: "user-support-001",
      email: "support@benefits-safe.test",
      firstName: "Taylor",
      lastName: "Davis",
      role: "support_agent" as const,
      organizationId: platformOrg.id,
    },
    {
      id: "user-compliance-001",
      email: "compliance@benefits-safe.test",
      firstName: "Nora",
      lastName: "Patel",
      role: "compliance_officer" as const,
      organizationId: platformOrg.id,
    },
    {
      id: "user-billing-001",
      email: "billing@benefits-safe.test",
      firstName: "Sam",
      lastName: "Johnson",
      role: "billing_admin" as const,
      organizationId: platformOrg.id,
    },
  ];

  for (const user of users) {
    const {
      dateOfBirth, addressStreet, addressCity, addressState, addressZip,
      benefitPrograms, emergencyContactName, emergencyContactPhone, notes,
      organizationId,
      ...baseFields
    } = user as typeof users[number] & Record<string, unknown>;

    const created = await prisma.user.upsert({
      where: { id: baseFields.id },
      update: {
        passwordHash,
        firstName: baseFields.firstName,
        lastName: baseFields.lastName,
        phone: baseFields.phone,
        dateOfBirth,
        addressStreet,
        addressCity,
        addressState,
        addressZip,
        benefitPrograms: benefitPrograms ?? undefined,
        emergencyContactName,
        emergencyContactPhone,
        notes,
      },
      create: {
        id: baseFields.id,
        email: baseFields.email,
        firstName: baseFields.firstName,
        lastName: baseFields.lastName,
        phone: baseFields.phone,
        role: baseFields.role,
        passwordHash,
        organizationId: organizationId as string,
        dateOfBirth,
        addressStreet,
        addressCity,
        addressState,
        addressZip,
        benefitPrograms: benefitPrograms ?? undefined,
        emergencyContactName,
        emergencyContactPhone,
        notes,
      },
    });
    console.log(`Created user: ${created.firstName} ${created.lastName} (${created.role}) — ${created.email}`);
  }

  console.log("\nSeed complete! All test users use password: Test1234!");
  console.log("\nTest accounts:");
  console.log("  admin@benefits-safe.test           → nonprofit_admin (Sarah Mitchell)");
  console.log("  staff@benefits-safe.test            → nonprofit_staff (Jordan Lee)");
  console.log("  beneficiary@benefits-safe.test       → beneficiary (James Carter)");
  console.log("  cpa@benefits-safe.test              → cpa (Maria Rodriguez)");
  console.log("  auditor@benefits-safe.test          → auditor (David Chen)");
  console.log("  vendor@benefits-safe.test           → vendor (Alex Thompson)");
  console.log("  attorney@benefits-safe.test         → attorney (Rachel Kim)");
  console.log("  grant.officer@benefits-safe.test    → grant_officer (Michael Torres)");
  console.log("  platform@benefits-safe.test         → platform_admin (Pat Williams)");
  console.log("  support@benefits-safe.test          → support_agent (Taylor Davis)");
  console.log("  compliance@benefits-safe.test       → compliance_officer (Nora Patel)");
  console.log("  billing@benefits-safe.test          → billing_admin (Sam Johnson)");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

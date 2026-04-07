import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/db";

const ORG_ID = "cmncq0p3e00008qba6uomou5j"; // BenefitsSafe Demo
const PASSWORD = "TestDev2024!";

interface TestUser {
  email: string;
  firstName: string;
  lastName: string;
  role: "platform_admin" | "nonprofit_staff" | "beneficiary" | "vendor" | "cpa" | "auditor" | "attorney" | "grant_officer" | "compliance_officer" | "support_agent" | "billing_admin";
  membershipRole: string;
  description: string;
}

const TEST_USERS: TestUser[] = [
  {
    email: "founder@benefitssafe.com",
    firstName: "Styner",
    lastName: "(Founder)",
    role: "platform_admin",
    membershipRole: "platform_admin",
    description: "Founder / Platform Admin - full admin dashboard",
  },
  {
    email: "staff@benefitssafe.com",
    firstName: "Test",
    lastName: "Case Manager",
    role: "nonprofit_staff",
    membershipRole: "nonprofit_staff",
    description: "Staff / Case Manager - staff view",
  },
  {
    email: "beneficiary@benefitssafe.com",
    firstName: "Test",
    lastName: "Beneficiary",
    role: "beneficiary",
    membershipRole: "beneficiary",
    description: "Beneficiary - /my-dashboard",
  },
  {
    email: "vendor@benefitssafe.com",
    firstName: "Test",
    lastName: "Vendor (Adobe Inc)",
    role: "vendor",
    membershipRole: "vendor",
    description: "Vendor - /vendor-dashboard",
  },
  {
    email: "auditor@benefitssafe.com",
    firstName: "Test",
    lastName: "CPA Auditor",
    role: "auditor",
    membershipRole: "auditor",
    description: "CPA / Auditor - auditor/reports view",
  },
  {
    email: "cpa@benefitssafe.com",
    firstName: "Test",
    lastName: "CPA",
    role: "cpa",
    membershipRole: "cpa",
    description: "CPA - reports & ledger view",
  },
  {
    email: "attorney@benefitssafe.com",
    firstName: "Test",
    lastName: "Attorney",
    role: "attorney",
    membershipRole: "attorney",
    description: "Attorney - compliance & legal review",
  },
  {
    email: "grantofficer@benefitssafe.com",
    firstName: "Test",
    lastName: "Grant Officer",
    role: "grant_officer",
    membershipRole: "grant_officer",
    description: "Grant Officer - grants & audit trail",
  },
  {
    email: "compliance@benefitssafe.com",
    firstName: "Test",
    lastName: "Compliance Officer",
    role: "compliance_officer",
    membershipRole: "compliance_officer",
    description: "Compliance Officer - compliance dashboard",
  },
  {
    email: "support@benefitssafe.com",
    firstName: "Test",
    lastName: "Support Agent",
    role: "support_agent",
    membershipRole: "support_agent",
    description: "Support Agent - support tools",
  },
  {
    email: "billing@benefitssafe.com",
    firstName: "Test",
    lastName: "Billing Admin",
    role: "billing_admin",
    membershipRole: "billing_admin",
    description: "Billing Admin - billing & plans",
  },
];

async function main() {
  console.log("Hashing password with bcryptjs (same as auth.ts)...");
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  console.log(`\nTarget org: BenefitsSafe Demo (${ORG_ID})\n`);

  for (const testUser of TEST_USERS) {
    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email: testUser.email },
      select: { id: true, email: true, role: true },
    });

    if (existing) {
      console.log(`SKIP: ${testUser.email} already exists (role: ${existing.role})`);
      continue;
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        email: testUser.email,
        firstName: testUser.firstName,
        lastName: testUser.lastName,
        passwordHash,
        role: testUser.role,
        organizationId: ORG_ID,
        isActive: true,
        emailVerified: true,
      },
    });

    console.log(`CREATED: ${testUser.email} (id: ${user.id}, role: ${testUser.role})`);

    // Create organization membership
    const membership = await prisma.organizationMembership.create({
      data: {
        userId: user.id,
        organizationId: ORG_ID,
        role: testUser.membershipRole,
        status: "active",
        isDefaultOrg: true,
      },
    });

    console.log(`  -> Membership: ${membership.id} (role: ${testUser.membershipRole})`);
  }

  // Print summary table
  console.log("\n" + "=".repeat(90));
  console.log("TEST USER ACCOUNTS SUMMARY");
  console.log("=".repeat(90));
  console.log(
    "Email".padEnd(35) +
    "Password".padEnd(16) +
    "Role".padEnd(20) +
    "Dashboard"
  );
  console.log("-".repeat(90));

  const allEmails = [...TEST_USERS.map((u) => u.email), "admin@benefitssafe.com"];
  const allUsers = await prisma.user.findMany({
    where: {
      email: { in: allEmails },
    },
    select: { email: true, role: true },
    orderBy: { email: "asc" },
  });

  const dashboardMap: Record<string, string> = {
    platform_admin: "/platform (Platform Admin)",
    nonprofit_admin: "/dashboard (Admin Dashboard)",
    nonprofit_staff: "/dashboard (Staff View)",
    beneficiary: "/my-dashboard (My Dashboard)",
    vendor: "/vendor-dashboard (Vendor Dashboard)",
    cpa: "/reports (Reports & Ledger)",
    auditor: "/audit-trail (Audit Trail)",
    attorney: "/compliance (Legal Review)",
    grant_officer: "/grants (Grant Oversight)",
    compliance_officer: "/compliance (Compliance Dashboard)",
    support_agent: "/support (Support Tools)",
    billing_admin: "/settings/billing (Billing & Plans)",
  };

  for (const u of allUsers) {
    console.log(
      u.email.padEnd(35) +
      PASSWORD.padEnd(16) +
      u.role.padEnd(20) +
      (dashboardMap[u.role] || "unknown")
    );
  }

  console.log("=".repeat(90));
  console.log("\nAll test accounts ready. You can log in at your app URL.");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("SEED FAILED:", e);
  process.exit(1);
});

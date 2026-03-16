import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";

// Load env vars for seed script (runs outside Next.js)
config({ path: ".env.local" });

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter }) as PrismaClient;

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

async function main() {
  console.log("Seeding demo data into existing database...\n");

  // ─── 1. LOOK UP EXISTING ORG & USERS ───────────────────────────────
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: "org-test-001" },
  });
  console.log(`Found org: ${org.name} (${org.id})`);

  const admin = await prisma.user.findUniqueOrThrow({
    where: { email: "admin@benefits-safe.test" },
  });
  const beneficiary = await prisma.user.findUniqueOrThrow({
    where: { email: "beneficiary@benefits-safe.test" },
  });
  const staff = await prisma.user.findUniqueOrThrow({
    where: { email: "staff@benefits-safe.test" },
  });
  console.log(`Found admin: ${admin.firstName} ${admin.lastName}`);
  console.log(`Found beneficiary: ${beneficiary.firstName} ${beneficiary.lastName}`);
  console.log(`Found staff: ${staff.firstName} ${staff.lastName}`);

  // ─── 2. CREATE 5 GRANTS ────────────────────────────────────────────
  console.log("\nCreating grants...");

  const grant1 = await prisma.grant.create({
    data: {
      organizationId: org.id,
      grantIssuerName: "National Arts Foundation",
      grantIssuerContact: "grants@naf.org",
      beneficiaryId: beneficiary.id,
      name: "Creative Writing Fellowship",
      description: "Fellowship supporting emerging writers who receive SSI benefits, covering professional development, software tools, and creative materials.",
      totalAmount: 25000,
      spentAmount: 4820.97,
      remainingAmount: 20179.03,
      status: "ACTIVE",
      startDate: daysAgo(90),
      endDate: new Date("2026-12-31"),
      restrictions: "Funds must be used for professional development, tools, and materials directly supporting the recipient's writing career. No cash disbursements.",
      benefitFlags: { ssi: true, ssdi: false, mediCal: true, medicaid: false, able: false, calFresh: false, ihss: false },
    },
  });
  console.log(`  Created grant: ${grant1.name} ($25,000)`);

  const grant2 = await prisma.grant.create({
    data: {
      organizationId: org.id,
      grantIssuerName: "Bay Area Tech Education Fund",
      grantIssuerContact: "info@batef.org",
      beneficiaryId: beneficiary.id,
      name: "Digital Skills Training",
      description: "Grant to fund digital literacy and software training for SSI recipients transitioning to freelance creative work.",
      totalAmount: 15000,
      spentAmount: 1289.97,
      remainingAmount: 13710.03,
      status: "ACTIVE",
      startDate: daysAgo(60),
      endDate: new Date("2026-09-30"),
      restrictions: "Software subscriptions, online courses, and training materials only. No hardware purchases over $500 without prior approval.",
      benefitFlags: { ssi: true, ssdi: false, mediCal: false, medicaid: false, able: false, calFresh: false, ihss: false },
    },
  });
  console.log(`  Created grant: ${grant2.name} ($15,000)`);

  const grant3 = await prisma.grant.create({
    data: {
      organizationId: org.id,
      grantIssuerName: "California Community Stability Initiative",
      grantIssuerContact: "housing@ccsi.org",
      name: "Housing Stability Support",
      description: "Large-scale grant for housing-related vendor payments on behalf of SSI/Medi-Cal/CalFresh recipients. Covers rent, utilities, and housing services.",
      totalAmount: 50000,
      spentAmount: 8500,
      remainingAmount: 41500,
      status: "ACTIVE",
      startDate: daysAgo(120),
      endDate: new Date("2027-06-30"),
      restrictions: "Housing-related payments only. All payments must go directly to vendors. No cash or reimbursement to beneficiaries.",
      benefitFlags: { ssi: true, ssdi: false, mediCal: true, medicaid: false, able: false, calFresh: true, ihss: false },
    },
  });
  console.log(`  Created grant: ${grant3.name} ($50,000)`);

  const grant4 = await prisma.grant.create({
    data: {
      organizationId: org.id,
      grantIssuerName: "Pacific Writers Collective",
      grantIssuerContact: "residency@pwc.org",
      beneficiaryId: beneficiary.id,
      name: "Artist Residency Grant",
      description: "Completed residency grant that covered a 3-month artist retreat including lodging, materials, and studio access.",
      totalAmount: 8000,
      spentAmount: 8000,
      remainingAmount: 0,
      status: "COMPLETED",
      startDate: daysAgo(200),
      endDate: daysAgo(90),
      restrictions: "Residency-related expenses only.",
      benefitFlags: { ssi: true, ssdi: false, mediCal: true, medicaid: false, able: false, calFresh: false, ihss: false },
    },
  });
  console.log(`  Created grant: ${grant4.name} ($8,000 — COMPLETED)`);

  const grant5 = await prisma.grant.create({
    data: {
      organizationId: org.id,
      grantIssuerName: "United Way Bay Area",
      grantIssuerContact: "emergency@uwba.org",
      name: "Emergency Relief Fund",
      description: "Draft grant for emergency assistance disbursements. Pending board approval and compliance review.",
      totalAmount: 10000,
      spentAmount: 0,
      remainingAmount: 10000,
      status: "DRAFT",
      startDate: new Date("2026-04-01"),
      endDate: new Date("2026-12-31"),
      restrictions: "Emergency needs only. Each disbursement requires executive director approval.",
    },
  });
  console.log(`  Created grant: ${grant5.name} ($10,000 — DRAFT)`);

  // ─── 3. CREATE BUDGET CATEGORIES (3 per active grant) ──────────────
  console.log("\nCreating budget categories...");

  const activeGrants = [
    { grant: grant1, total: 25000 },
    { grant: grant2, total: 15000 },
    { grant: grant3, total: 50000 },
  ];

  const categoryMap: Record<string, { profSvc: string; software: string; materials: string }> = {};

  for (const { grant, total } of activeGrants) {
    const profSvc = await prisma.budgetCategory.create({
      data: {
        grantId: grant.id,
        name: "Professional Services",
        allocatedAmount: Math.round(total * 0.4 * 100) / 100,
        spentAmount: 0,
      },
    });
    const software = await prisma.budgetCategory.create({
      data: {
        grantId: grant.id,
        name: "Software & Subscriptions",
        allocatedAmount: Math.round(total * 0.3 * 100) / 100,
        spentAmount: 0,
      },
    });
    const materials = await prisma.budgetCategory.create({
      data: {
        grantId: grant.id,
        name: "Materials & Equipment",
        allocatedAmount: Math.round(total * 0.3 * 100) / 100,
        spentAmount: 0,
      },
    });
    categoryMap[grant.id] = {
      profSvc: profSvc.id,
      software: software.id,
      materials: materials.id,
    };
    console.log(`  Created 3 categories for "${grant.name}"`);
  }

  // ─── 4. CREATE 8 VENDORS ───────────────────────────────────────────
  console.log("\nCreating vendors...");

  const vendorAdobe = await prisma.vendor.create({
    data: {
      organizationId: org.id,
      name: "Adobe Inc",
      type: "SAAS_SUBSCRIPTION",
      email: "billing@adobe.com",
      website: "https://www.adobe.com",
      status: "APPROVED",
      approvedAt: daysAgo(80),
      taxIdCollected: true,
      form1099Required: false,
      paymentMethod: "card",
    },
  });

  const vendorScrivener = await prisma.vendor.create({
    data: {
      organizationId: org.id,
      name: "Literature & Latte (Scrivener)",
      type: "SAAS_SUBSCRIPTION",
      email: "support@literatureandlatte.com",
      website: "https://www.literatureandlatte.com",
      status: "APPROVED",
      approvedAt: daysAgo(75),
      taxIdCollected: true,
      form1099Required: false,
      paymentMethod: "card",
    },
  });

  const vendorChatGPT = await prisma.vendor.create({
    data: {
      organizationId: org.id,
      name: "OpenAI (ChatGPT)",
      type: "SAAS_SUBSCRIPTION",
      email: "billing@openai.com",
      website: "https://chat.openai.com",
      status: "ACTIVE",
      approvedAt: daysAgo(50),
      taxIdCollected: true,
      form1099Required: false,
      paymentMethod: "card",
    },
  });

  const vendorMaria = await prisma.vendor.create({
    data: {
      organizationId: org.id,
      name: "Maria's Editing Services",
      type: "SERVICE_PROVIDER",
      email: "maria@editingservices.com",
      phone: "(510) 555-0199",
      status: "APPROVED",
      approvedAt: daysAgo(70),
      taxIdCollected: true,
      form1099Required: true,
      paymentMethod: "ach",
    },
  });

  const vendorPrint = await prisma.vendor.create({
    data: {
      organizationId: org.id,
      name: "Bay Area Print Shop",
      type: "ONE_TIME_VENDOR",
      email: "orders@bayareaprint.com",
      phone: "(415) 555-0188",
      address: "456 Mission St, San Francisco, CA 94105",
      status: "APPROVED",
      approvedAt: daysAgo(40),
      taxIdCollected: true,
      form1099Required: false,
      paymentMethod: "card",
    },
  });

  const vendorTechRepair = await prisma.vendor.create({
    data: {
      organizationId: org.id,
      name: "TechRepair Co",
      type: "ONE_TIME_VENDOR",
      email: "service@techrepair.co",
      phone: "(408) 555-0177",
      status: "PENDING",
      taxIdCollected: false,
      form1099Required: false,
    },
  });

  const vendorCloudBackup = await prisma.vendor.create({
    data: {
      organizationId: org.id,
      name: "CloudBackup Pro",
      type: "SAAS_SUBSCRIPTION",
      email: "support@cloudbackuppro.com",
      website: "https://cloudbackuppro.com",
      status: "PENDING",
      taxIdCollected: false,
      form1099Required: false,
    },
  });

  const vendorWritingCoach = await prisma.vendor.create({
    data: {
      organizationId: org.id,
      name: "Writing Coach LLC",
      type: "SERVICE_PROVIDER",
      email: "booking@writingcoach.com",
      website: "https://writingcoach.com",
      phone: "(510) 555-0166",
      status: "ACTIVE",
      approvedAt: daysAgo(60),
      taxIdCollected: true,
      form1099Required: true,
      paymentMethod: "ach",
    },
  });

  console.log("  Created 8 vendors: Adobe, Scrivener, ChatGPT, Maria's Editing, Bay Area Print, TechRepair, CloudBackup, Writing Coach");

  // ─── 5. CREATE 12 EXPENSE REQUESTS ─────────────────────────────────
  console.log("\nCreating expense requests...");

  const cat1 = categoryMap[grant1.id];
  const cat2 = categoryMap[grant2.id];
  const cat3 = categoryMap[grant3.id];

  // Expense 1 — APPROVED, LIKELY_SAFE
  const exp1 = await prisma.expenseRequest.create({
    data: {
      grantId: grant1.id,
      categoryId: cat1.software,
      requestedById: beneficiary.id,
      vendorId: vendorAdobe.id,
      description: "Adobe Creative Cloud annual subscription for manuscript design and layout",
      amount: 659.88,
      frequency: "ANNUAL",
      expenseType: "subscription",
      vendorName: "Adobe Inc",
      vendorEmail: "billing@adobe.com",
      riskClassification: "LIKELY_SAFE",
      riskNotes: "Standard software subscription paid directly to vendor. No income to beneficiary.",
      status: "APPROVED",
      approvedById: admin.id,
      approvedAt: daysAgo(78),
      createdAt: daysAgo(80),
    },
  });

  // Expense 2 — APPROVED, LIKELY_SAFE
  const exp2 = await prisma.expenseRequest.create({
    data: {
      grantId: grant1.id,
      categoryId: cat1.profSvc,
      requestedById: beneficiary.id,
      vendorId: vendorMaria.id,
      description: "Developmental editing for first 3 chapters of novel manuscript",
      amount: 1500,
      frequency: "ONE_TIME",
      expenseType: "invoice",
      vendorName: "Maria's Editing Services",
      vendorEmail: "maria@editingservices.com",
      riskClassification: "LIKELY_SAFE",
      riskNotes: "Professional service paid directly to vendor for grant-related creative work. Does not constitute income to beneficiary.",
      status: "APPROVED",
      approvedById: admin.id,
      approvedAt: daysAgo(65),
      createdAt: daysAgo(68),
    },
  });

  // Expense 3 — APPROVED, LIKELY_SAFE
  const exp3 = await prisma.expenseRequest.create({
    data: {
      grantId: grant2.id,
      categoryId: cat2.software,
      requestedById: beneficiary.id,
      vendorId: vendorChatGPT.id,
      description: "ChatGPT Plus monthly subscription for AI-assisted writing research",
      amount: 240,
      frequency: "MONTHLY",
      expenseType: "subscription",
      vendorName: "OpenAI (ChatGPT)",
      vendorEmail: "billing@openai.com",
      riskClassification: "LIKELY_SAFE",
      riskNotes: "Software subscription paid directly to vendor. Standard digital tool for professional development.",
      status: "APPROVED",
      approvedById: admin.id,
      approvedAt: daysAgo(48),
      createdAt: daysAgo(50),
    },
  });

  // Expense 4 — PENDING, LIKELY_SAFE
  await prisma.expenseRequest.create({
    data: {
      grantId: grant1.id,
      categoryId: cat1.profSvc,
      requestedById: beneficiary.id,
      vendorId: vendorWritingCoach.id,
      description: "6-week writing workshop: Advanced Fiction Techniques",
      amount: 800,
      frequency: "ONE_TIME",
      expenseType: "invoice",
      vendorName: "Writing Coach LLC",
      vendorEmail: "booking@writingcoach.com",
      riskClassification: "LIKELY_SAFE",
      riskNotes: "Educational service paid directly to vendor. Professional development covered by grant restrictions.",
      status: "PENDING",
      createdAt: daysAgo(5),
    },
  });

  // Expense 5 — PENDING, LIKELY_SAFE
  await prisma.expenseRequest.create({
    data: {
      grantId: grant2.id,
      categoryId: cat2.materials,
      requestedById: beneficiary.id,
      vendorId: vendorPrint.id,
      description: "Print 50 copies of portfolio booklet for workshop distribution",
      amount: 175,
      frequency: "ONE_TIME",
      expenseType: "invoice",
      vendorName: "Bay Area Print Shop",
      vendorEmail: "orders@bayareaprint.com",
      riskClassification: "LIKELY_SAFE",
      riskNotes: "Materials purchase paid directly to vendor for grant-related activity.",
      status: "PENDING",
      createdAt: daysAgo(3),
    },
  });

  // Expense 6 — PENDING, NEEDS_REVIEW
  await prisma.expenseRequest.create({
    data: {
      grantId: grant1.id,
      categoryId: cat1.materials,
      requestedById: beneficiary.id,
      vendorId: vendorTechRepair.id,
      description: "Laptop screen repair — needed for grant writing work",
      amount: 350,
      frequency: "ONE_TIME",
      expenseType: "equipment",
      vendorName: "TechRepair Co",
      vendorEmail: "service@techrepair.co",
      riskClassification: "NEEDS_REVIEW",
      riskNotes: "Equipment repair may increase asset value. Review needed to confirm it does not affect SSI resource limits under POMS SI 01130.000.",
      status: "PENDING",
      createdAt: daysAgo(2),
    },
  });

  // Expense 7 — PAID, LIKELY_SAFE
  const exp7 = await prisma.expenseRequest.create({
    data: {
      grantId: grant1.id,
      categoryId: cat1.software,
      requestedById: beneficiary.id,
      vendorId: vendorScrivener.id,
      description: "Scrivener 3 writing software — annual license renewal",
      amount: 49,
      frequency: "ANNUAL",
      expenseType: "subscription",
      vendorName: "Literature & Latte (Scrivener)",
      vendorEmail: "support@literatureandlatte.com",
      riskClassification: "LIKELY_SAFE",
      riskNotes: "Standard writing software subscription. Paid directly to vendor.",
      status: "PAID",
      approvedById: admin.id,
      approvedAt: daysAgo(73),
      createdAt: daysAgo(75),
    },
  });

  // Expense 8 — PAID, LIKELY_SAFE
  const exp8 = await prisma.expenseRequest.create({
    data: {
      grantId: grant2.id,
      categoryId: cat2.profSvc,
      requestedById: beneficiary.id,
      vendorId: vendorWritingCoach.id,
      description: "One-on-one coaching session: publishing industry fundamentals",
      amount: 200,
      frequency: "ONE_TIME",
      expenseType: "invoice",
      vendorName: "Writing Coach LLC",
      vendorEmail: "booking@writingcoach.com",
      riskClassification: "LIKELY_SAFE",
      riskNotes: "Professional coaching service paid directly to vendor. Supports grant-funded training objectives.",
      status: "PAID",
      approvedById: admin.id,
      approvedAt: daysAgo(30),
      createdAt: daysAgo(35),
    },
  });

  // Expense 9 — NEEDS_REVIEW, NEEDS_REVIEW
  await prisma.expenseRequest.create({
    data: {
      grantId: grant3.id,
      categoryId: cat3.profSvc,
      requestedById: staff.id,
      description: "Utility deposit payment for beneficiary transitional housing unit",
      amount: 500,
      frequency: "ONE_TIME",
      expenseType: "invoice",
      vendorName: "PG&E",
      vendorEmail: "business@pge.com",
      riskClassification: "NEEDS_REVIEW",
      riskNotes: "Utility payment on behalf of beneficiary. Requires review per org disbursement policy — rent/utility payments require compliance check under POMS SI 00835.350.",
      status: "PENDING",
      createdAt: daysAgo(4),
    },
  });

  // Expense 10 — NEEDS_REVIEW
  await prisma.expenseRequest.create({
    data: {
      grantId: grant1.id,
      categoryId: cat1.materials,
      requestedById: beneficiary.id,
      description: "Ergonomic desk chair for home writing workspace",
      amount: 450,
      frequency: "ONE_TIME",
      expenseType: "equipment",
      vendorName: "Office Depot",
      vendorEmail: "orders@officedepot.com",
      riskClassification: "NEEDS_REVIEW",
      riskNotes: "Furniture purchase may be countable resource under SSI. Review needed to confirm item is excluded as Plan to Achieve Self-Support (PASS) expense or falls under household goods exclusion.",
      status: "PENDING",
      createdAt: daysAgo(1),
    },
  });

  // Expense 11 — REJECTED, LIKELY_RISKY
  await prisma.expenseRequest.create({
    data: {
      grantId: grant1.id,
      categoryId: cat1.materials,
      requestedById: beneficiary.id,
      description: "Gift cards for writing group members as thank-you for feedback",
      amount: 200,
      frequency: "ONE_TIME",
      expenseType: "equipment",
      vendorName: "Amazon",
      vendorEmail: "payments@amazon.com",
      riskClassification: "LIKELY_RISKY",
      riskNotes: "Gift cards are cash equivalents. Purchasing gift cards with grant funds could be construed as income to recipients, jeopardizing SSI eligibility under POMS SI 00830.522.",
      status: "REJECTED",
      approvedById: admin.id,
      approvedAt: daysAgo(10),
      rejectedReason: "Gift cards are considered cash equivalents and cannot be purchased with restricted grant funds. This could affect beneficiary SSI eligibility.",
      createdAt: daysAgo(12),
    },
  });

  // Expense 12 — BLOCKED
  await prisma.expenseRequest.create({
    data: {
      grantId: grant1.id,
      categoryId: cat1.profSvc,
      requestedById: beneficiary.id,
      description: "Cash advance for travel to writers conference",
      amount: 1500,
      frequency: "ONE_TIME",
      expenseType: "invoice",
      riskClassification: "BLOCKED",
      riskNotes: "BLOCKED: Cash disbursement directly to beneficiary is prohibited. Cash to SSI recipients is countable income under POMS SI 00810.005 and would reduce SSI payment dollar-for-dollar.",
      status: "REJECTED",
      approvedById: admin.id,
      approvedAt: daysAgo(8),
      rejectedReason: "Cash advance to beneficiary is automatically blocked. Grant funds must be paid directly to vendors per SSI in-kind support rules.",
      createdAt: daysAgo(9),
    },
  });

  console.log("  Created 12 expense requests (3 APPROVED, 3 PENDING, 2 PAID, 2 NEEDS_REVIEW, 1 REJECTED, 1 BLOCKED)");

  // ─── 6. CREATE APPROVALS FOR APPROVED/PAID/REJECTED EXPENSES ───────
  console.log("\nCreating approval records...");

  for (const exp of [exp1, exp2, exp3, exp7, exp8]) {
    await prisma.approval.create({
      data: {
        expenseId: exp.id,
        approverId: admin.id,
        action: "APPROVED",
        notes: "Expense meets grant restrictions and compliance requirements.",
      },
    });
  }
  console.log("  Created 5 approval records");

  // ─── 7. CREATE 4 SUBSCRIPTIONS ─────────────────────────────────────
  console.log("\nCreating subscriptions...");

  // We'll create the virtual cards first so we can link them
  // ─── 8. CREATE 3 VIRTUAL CARDS ─────────────────────────────────────
  console.log("\nCreating virtual cards...");

  const cardAdobe = await prisma.virtualCard.create({
    data: {
      organizationId: org.id,
      categoryId: cat1.software,
      vendorId: vendorAdobe.id,
      beneficiaryId: beneficiary.id,
      stripeCardId: "ic_demo_adobe_001",
      last4: "4242",
      expirationMonth: 12,
      expirationYear: 2027,
      spendingCap: 660,
      merchantLock: "Adobe Inc",
      cardType: "monthly",
      status: "ACTIVE",
    },
  });
  console.log("  Created card: Adobe (last4: 4242, cap: $660)");

  const cardScrivener = await prisma.virtualCard.create({
    data: {
      organizationId: org.id,
      categoryId: cat1.software,
      vendorId: vendorScrivener.id,
      beneficiaryId: beneficiary.id,
      stripeCardId: "ic_demo_scrivener_001",
      last4: "8888",
      expirationMonth: 6,
      expirationYear: 2027,
      spendingCap: 49,
      merchantLock: "Literature & Latte",
      cardType: "one_time",
      status: "ACTIVE",
    },
  });
  console.log("  Created card: Scrivener (last4: 8888, cap: $49)");

  const cardGeneral = await prisma.virtualCard.create({
    data: {
      organizationId: org.id,
      categoryId: cat1.profSvc,
      beneficiaryId: beneficiary.id,
      stripeCardId: "ic_demo_general_001",
      last4: "1234",
      expirationMonth: 12,
      expirationYear: 2027,
      spendingCap: 5000,
      cardType: "custom",
      status: "ACTIVE",
    },
  });
  console.log("  Created card: General Services (last4: 1234, cap: $5,000)");

  // Now create subscriptions with card links
  await prisma.subscription.create({
    data: {
      vendorId: vendorAdobe.id,
      grantId: grant1.id,
      categoryId: cat1.software,
      serviceName: "Adobe Creative Cloud",
      loginEmail: "james.carter@benefits-safe.test",
      monthlyCost: 54.99,
      billingCycle: "monthly",
      renewalDate: new Date("2026-04-15"),
      cardId: cardAdobe.id,
      billingUpdateStatus: "VERIFIED",
      status: "ACTIVE",
    },
  });

  await prisma.subscription.create({
    data: {
      vendorId: vendorScrivener.id,
      grantId: grant1.id,
      categoryId: cat1.software,
      serviceName: "Scrivener 3",
      loginEmail: "james.carter@benefits-safe.test",
      monthlyCost: 49,
      billingCycle: "annual",
      renewalDate: new Date("2027-01-15"),
      cardId: cardScrivener.id,
      billingUpdateStatus: "UPDATED",
      status: "ACTIVE",
    },
  });

  await prisma.subscription.create({
    data: {
      vendorId: vendorChatGPT.id,
      grantId: grant2.id,
      categoryId: cat2.software,
      serviceName: "ChatGPT Plus",
      loginEmail: "james.carter@benefits-safe.test",
      monthlyCost: 20,
      billingCycle: "monthly",
      renewalDate: new Date("2026-04-01"),
      billingUpdateStatus: "CARD_SHARED",
      status: "ACTIVE",
    },
  });

  await prisma.subscription.create({
    data: {
      vendorId: vendorCloudBackup.id,
      grantId: grant2.id,
      categoryId: cat2.software,
      serviceName: "CloudBackup Pro",
      loginEmail: "james.carter@benefits-safe.test",
      monthlyCost: 9.99,
      billingCycle: "monthly",
      renewalDate: new Date("2026-04-10"),
      billingUpdateStatus: "PENDING",
      status: "ACTIVE",
    },
  });

  console.log("  Created 4 subscriptions: Adobe CC, Scrivener, ChatGPT Plus, CloudBackup Pro");

  // ─── 9. CREATE TRANSACTIONS ─────────────────────────────────────────
  console.log("\nCreating transactions...");

  await prisma.transaction.create({
    data: {
      organizationId: org.id,
      cardId: cardAdobe.id,
      stripeTransactionId: "txn_demo_adobe_001",
      amount: 54.99,
      merchantName: "Adobe Inc",
      merchantCategory: "software",
      status: "completed",
      grantId: grant1.id,
      createdAt: daysAgo(30),
    },
  });

  await prisma.transaction.create({
    data: {
      organizationId: org.id,
      cardId: cardAdobe.id,
      stripeTransactionId: "txn_demo_adobe_002",
      amount: 54.99,
      merchantName: "Adobe Inc",
      merchantCategory: "software",
      status: "completed",
      grantId: grant1.id,
      createdAt: daysAgo(0),
    },
  });

  await prisma.transaction.create({
    data: {
      organizationId: org.id,
      cardId: cardScrivener.id,
      stripeTransactionId: "txn_demo_scriv_001",
      amount: 49,
      merchantName: "Literature & Latte",
      merchantCategory: "software",
      status: "completed",
      grantId: grant1.id,
      createdAt: daysAgo(73),
    },
  });

  await prisma.transaction.create({
    data: {
      organizationId: org.id,
      cardId: cardGeneral.id,
      stripeTransactionId: "txn_demo_gen_001",
      amount: 1500,
      merchantName: "Maria's Editing Services",
      merchantCategory: "professional_services",
      status: "completed",
      grantId: grant1.id,
      createdAt: daysAgo(63),
    },
  });

  await prisma.transaction.create({
    data: {
      organizationId: org.id,
      cardId: cardGeneral.id,
      stripeTransactionId: "txn_demo_gen_002",
      amount: 200,
      merchantName: "Writing Coach LLC",
      merchantCategory: "professional_services",
      status: "completed",
      grantId: grant2.id,
      createdAt: daysAgo(28),
    },
  });

  console.log("  Created 5 card transactions");

  // ─── 10. CREATE 15 LEDGER ENTRIES ───────────────────────────────────
  console.log("\nCreating ledger entries...");

  // Grant 1 — Creative Writing Fellowship ($25,000)
  await prisma.ledgerEntry.create({
    data: {
      grantId: grant1.id,
      type: "CREDIT",
      amount: 25000,
      balanceAfter: 25000,
      description: "Initial grant funding received — Creative Writing Fellowship",
      reference: "GF-2025-CWF-001",
      createdAt: daysAgo(90),
    },
  });
  await prisma.ledgerEntry.create({
    data: {
      grantId: grant1.id,
      expenseId: exp1.id,
      categoryId: cat1.software,
      type: "DEBIT",
      amount: 659.88,
      balanceAfter: 24340.12,
      description: "Adobe Creative Cloud annual subscription",
      reference: "EXP-001",
      createdAt: daysAgo(78),
    },
  });
  await prisma.ledgerEntry.create({
    data: {
      grantId: grant1.id,
      expenseId: exp7.id,
      categoryId: cat1.software,
      type: "DEBIT",
      amount: 49,
      balanceAfter: 24291.12,
      description: "Scrivener 3 annual license renewal",
      reference: "EXP-007",
      createdAt: daysAgo(73),
    },
  });
  await prisma.ledgerEntry.create({
    data: {
      grantId: grant1.id,
      expenseId: exp2.id,
      categoryId: cat1.profSvc,
      type: "DEBIT",
      amount: 1500,
      balanceAfter: 22791.12,
      description: "Maria's Editing Services — developmental editing",
      reference: "EXP-002",
      createdAt: daysAgo(63),
    },
  });
  // Additional debits to match spentAmount
  await prisma.ledgerEntry.create({
    data: {
      grantId: grant1.id,
      categoryId: cat1.software,
      type: "DEBIT",
      amount: 54.99,
      balanceAfter: 22736.13,
      description: "Adobe Creative Cloud — March billing",
      reference: "TXN-ADOBE-MAR",
      createdAt: daysAgo(30),
    },
  });

  // Grant 2 — Digital Skills Training ($15,000)
  await prisma.ledgerEntry.create({
    data: {
      grantId: grant2.id,
      type: "CREDIT",
      amount: 15000,
      balanceAfter: 15000,
      description: "Initial grant funding received — Digital Skills Training",
      reference: "GF-2025-DST-001",
      createdAt: daysAgo(60),
    },
  });
  await prisma.ledgerEntry.create({
    data: {
      grantId: grant2.id,
      expenseId: exp3.id,
      categoryId: cat2.software,
      type: "DEBIT",
      amount: 240,
      balanceAfter: 14760,
      description: "ChatGPT Plus subscription (12 months prepaid equivalent)",
      reference: "EXP-003",
      createdAt: daysAgo(48),
    },
  });
  await prisma.ledgerEntry.create({
    data: {
      grantId: grant2.id,
      expenseId: exp8.id,
      categoryId: cat2.profSvc,
      type: "DEBIT",
      amount: 200,
      balanceAfter: 14560,
      description: "Writing Coach LLC — publishing fundamentals session",
      reference: "EXP-008",
      createdAt: daysAgo(28),
    },
  });

  // Grant 3 — Housing Stability Support ($50,000)
  await prisma.ledgerEntry.create({
    data: {
      grantId: grant3.id,
      type: "CREDIT",
      amount: 50000,
      balanceAfter: 50000,
      description: "Initial grant funding received — Housing Stability Support",
      reference: "GF-2025-HSS-001",
      createdAt: daysAgo(120),
    },
  });
  await prisma.ledgerEntry.create({
    data: {
      grantId: grant3.id,
      categoryId: cat3.profSvc,
      type: "DEBIT",
      amount: 3500,
      balanceAfter: 46500,
      description: "First month rent — transitional housing unit A",
      reference: "HSG-RENT-001",
      createdAt: daysAgo(100),
    },
  });
  await prisma.ledgerEntry.create({
    data: {
      grantId: grant3.id,
      categoryId: cat3.profSvc,
      type: "DEBIT",
      amount: 3500,
      balanceAfter: 43000,
      description: "Second month rent — transitional housing unit A",
      reference: "HSG-RENT-002",
      createdAt: daysAgo(70),
    },
  });
  await prisma.ledgerEntry.create({
    data: {
      grantId: grant3.id,
      categoryId: cat3.materials,
      type: "DEBIT",
      amount: 1500,
      balanceAfter: 41500,
      description: "Security deposit — transitional housing unit B",
      reference: "HSG-DEP-001",
      createdAt: daysAgo(45),
    },
  });

  // Grant 4 — Artist Residency ($8,000 COMPLETED)
  await prisma.ledgerEntry.create({
    data: {
      grantId: grant4.id,
      type: "CREDIT",
      amount: 8000,
      balanceAfter: 8000,
      description: "Initial grant funding received — Artist Residency Grant",
      reference: "GF-2025-ARG-001",
      createdAt: daysAgo(200),
    },
  });
  await prisma.ledgerEntry.create({
    data: {
      grantId: grant4.id,
      type: "DEBIT",
      amount: 5000,
      balanceAfter: 3000,
      description: "Residency lodging and studio fees",
      reference: "RES-LODGE-001",
      createdAt: daysAgo(180),
    },
  });
  await prisma.ledgerEntry.create({
    data: {
      grantId: grant4.id,
      type: "DEBIT",
      amount: 3000,
      balanceAfter: 0,
      description: "Residency materials, supplies, and travel",
      reference: "RES-MAT-001",
      createdAt: daysAgo(110),
    },
  });

  console.log("  Created 15 ledger entries (5 CREDITs + 10 DEBITs)");

  // ─── 11. CREATE 10 AUDIT LOG ENTRIES ────────────────────────────────
  console.log("\nCreating audit log entries...");

  const auditEntries = [
    {
      userId: admin.id,
      organizationId: org.id,
      action: "create",
      entityType: "grant",
      entityId: grant1.id,
      newValue: { name: "Creative Writing Fellowship", totalAmount: 25000 },
      createdAt: daysAgo(90),
    },
    {
      userId: admin.id,
      organizationId: org.id,
      action: "create",
      entityType: "grant",
      entityId: grant2.id,
      newValue: { name: "Digital Skills Training", totalAmount: 15000 },
      createdAt: daysAgo(60),
    },
    {
      userId: beneficiary.id,
      organizationId: org.id,
      action: "create",
      entityType: "expense",
      entityId: exp1.id,
      newValue: { description: "Adobe Creative Cloud annual subscription", amount: 659.88 },
      createdAt: daysAgo(80),
    },
    {
      userId: admin.id,
      organizationId: org.id,
      action: "approve",
      entityType: "expense",
      entityId: exp1.id,
      oldValue: { status: "PENDING" },
      newValue: { status: "APPROVED" },
      createdAt: daysAgo(78),
    },
    {
      userId: beneficiary.id,
      organizationId: org.id,
      action: "create",
      entityType: "expense",
      entityId: exp2.id,
      newValue: { description: "Developmental editing for manuscript", amount: 1500 },
      createdAt: daysAgo(68),
    },
    {
      userId: admin.id,
      organizationId: org.id,
      action: "approve",
      entityType: "vendor",
      entityId: vendorAdobe.id,
      oldValue: { status: "PENDING" },
      newValue: { status: "APPROVED" },
      createdAt: daysAgo(80),
    },
    {
      userId: admin.id,
      organizationId: org.id,
      action: "approve",
      entityType: "vendor",
      entityId: vendorMaria.id,
      oldValue: { status: "PENDING" },
      newValue: { status: "APPROVED" },
      createdAt: daysAgo(70),
    },
    {
      userId: admin.id,
      organizationId: org.id,
      action: "create",
      entityType: "card",
      entityId: cardAdobe.id,
      newValue: { last4: "4242", spendingCap: 660, vendor: "Adobe Inc" },
      createdAt: daysAgo(78),
    },
    {
      userId: admin.id,
      organizationId: org.id,
      action: "create",
      entityType: "card",
      entityId: cardGeneral.id,
      newValue: { last4: "1234", spendingCap: 5000, type: "multi-vendor" },
      createdAt: daysAgo(65),
    },
    {
      userId: admin.id,
      organizationId: org.id,
      action: "reject",
      entityType: "expense",
      entityId: exp1.id, // using exp1 id as placeholder — represents the gift card rejection
      oldValue: { status: "PENDING" },
      newValue: { status: "REJECTED", reason: "Gift cards are cash equivalents" },
      createdAt: daysAgo(10),
    },
  ];

  for (const entry of auditEntries) {
    await prisma.auditLog.create({ data: entry });
  }
  console.log("  Created 10 audit log entries");

  // ─── 12. CREATE DISBURSEMENT POLICY ─────────────────────────────────
  console.log("\nCreating disbursement policy...");

  await prisma.disbursementPolicy.create({
    data: {
      organizationId: org.id,
      cashToRecipient: "DISALLOWED",
      reimbursementToRecipient: "DISALLOWED",
      rentUtilityPayments: "REQUIRES_REVIEW",
      recurringSubscriptions: "ALLOWED",
      maxSingleTransaction: 5000,
      allowedCategories: [
        "Professional Services",
        "Software & Subscriptions",
        "Materials & Equipment",
        "Education & Training",
        "Housing Services",
      ],
      blockedCategories: [
        "Cash Advances",
        "Gift Cards",
        "Personal Entertainment",
        "Alcohol & Tobacco",
      ],
    },
  });
  console.log("  Created org-level disbursement policy");

  // ─── DONE ───────────────────────────────────────────────────────────
  console.log("\n========================================");
  console.log("Demo data seeding complete!");
  console.log("========================================");
  console.log("\nCreated:");
  console.log("  5 grants (3 ACTIVE, 1 COMPLETED, 1 DRAFT)");
  console.log("  9 budget categories (3 per active grant)");
  console.log("  8 vendors (mixed types and statuses)");
  console.log("  12 expense requests (mixed statuses and risk levels)");
  console.log("  5 approval records");
  console.log("  4 subscriptions");
  console.log("  3 virtual cards");
  console.log("  5 card transactions");
  console.log("  15 ledger entries (5 credits + 10 debits)");
  console.log("  10 audit log entries");
  console.log("  1 disbursement policy");
}

main()
  .catch((e) => {
    console.error("Demo data seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

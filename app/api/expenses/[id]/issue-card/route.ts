// @ts-nocheck
// POST /api/expenses/[id]/issue-card — Issue a virtual card for an approved expense
// ORG-SCOPED, ORG-ISOLATED at the card level

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { rateLimit, RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";
import { checkLimitAccess, buildLimitReachedResponse, getCurrentPeriod } from "@/lib/feature-gates";
import { incrementUsage } from "@/lib/usage-tracker";
import { screenAgainstOFAC } from "@/lib/ofac-screening";
import { BLOCKED_MCC_CODES } from "@/lib/mcc-controls";
import { NextResponse } from "next/server";
import { z } from "zod";

const issueCardSchema = z.object({
  cardType: z.enum(["one_time", "monthly", "custom"]).default("one_time"),
  expiresAt: z.string().datetime().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, organizationId, id: userId } = session.user;
    if (role !== "nonprofit_admin" && role !== "platform_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Rate limit: max 10 card issues per minute per user per org
    const rateLimitKey = `card-issue:${organizationId}:${userId}`;
    const limitResult = rateLimit(rateLimitKey, RATE_LIMIT_CONFIGS.cardIssuance);

    if (!limitResult.allowed) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          message: "Too many card issuance requests. Please wait before trying again.",
          retryAfter: limitResult.resetAt,
        },
        { status: 429, headers: { "Retry-After": limitResult.resetAt.toISOString() } },
      );
    }

    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === "sk_test_REMOVED_PLACEHOLDER") {
      return NextResponse.json(
        { error: "Stripe is not configured. Add STRIPE_SECRET_KEY to environment variables." },
        { status: 503 },
      );
    }

    // Gate: organization must have a connected bank account to issue cards
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { stripeAccountId: true },
    });
    if (!org?.stripeAccountId) {
      return NextResponse.json(
        { error: "Connect your bank account before issuing cards. Go to Organization Settings > Funding to connect." },
        { status: 400 },
      );
    }

    // Plan limit gate: check this month's card issuance against tier limit
    const period = getCurrentPeriod();
    const usage = await prisma.usageCounter.findUnique({
      where: { organizationId_period: { organizationId, period } },
      select: { cardsIssued: true },
    });
    const currentCardsIssued = usage?.cardsIssued ?? 0;
    const limitCheck = await checkLimitAccess(
      organizationId,
      "maxCardsPerMonth",
      currentCardsIssued,
    );
    if (!limitCheck.allowed) {
      return NextResponse.json(
        buildLimitReachedResponse("maxCardsPerMonth", limitCheck),
        { status: 403 },
      );
    }

    const { id: expenseId } = await params;
    const body = await request.json();
    const parsed = issueCardSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { cardType, expiresAt } = parsed.data;

    // Fetch expense with org isolation
    const expense = await prisma.expenseRequest.findFirst({
      where: {
        id: expenseId,
        grant: { organizationId },
        status: "APPROVED",
      },
      select: {
        id: true,
        amount: true,
        description: true,
        vendorId: true,
        requestedById: true,
        grantId: true,
        categoryId: true,
        vendor: { select: { id: true, name: true, type: true } },
        requestedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        grant: { select: { id: true, name: true, organizationId: true } },
        virtualCards: { select: { id: true, status: true } },
      },
    });

    if (!expense) {
      return NextResponse.json(
        { error: "Approved expense not found or not in your organization" },
        { status: 404 },
      );
    }

    // Check if active card already exists
    const activeCard = expense.virtualCards.find((c) => c.status === "ACTIVE");
    if (activeCard) {
      return NextResponse.json(
        { error: "An active card already exists for this expense" },
        { status: 409 },
      );
    }

    // Check cardholder eligibility before issuing
    const eligibility = await prisma.cardholderEligibility.findUnique({
      where: { beneficiaryId: expense.requestedById },
      select: { eligibilityStatus: true },
    });

    if (eligibility?.eligibilityStatus === "INELIGIBLE_WARRANT" ||
        eligibility?.eligibilityStatus === "INELIGIBLE_INCARCERATED") {
      return NextResponse.json(
        { error: `Cannot issue card: beneficiary is ${eligibility.eligibilityStatus === "INELIGIBLE_WARRANT" ? "ineligible due to active warrant" : "currently incarcerated"}` },
        { status: 403 },
      );
    }

    if (!eligibility || eligibility.eligibilityStatus === "PENDING_VERIFICATION") {
      return NextResponse.json(
        { error: "Beneficiary eligibility has not been verified. Please complete the eligibility verification first." },
        { status: 400 },
      );
    }

    // OFAC sanctions screening
    const beneficiaryForOFAC = await prisma.user.findUnique({
      where: { id: expense.requestedById },
      select: { firstName: true, lastName: true },
    });

    if (beneficiaryForOFAC) {
      const ofacResult = await screenAgainstOFAC(beneficiaryForOFAC.firstName, beneficiaryForOFAC.lastName);

      if (ofacResult.matchFound) {
        // Update eligibility record
        await prisma.cardholderEligibility.upsert({
          where: { beneficiaryId: expense.requestedById },
          update: { ofacScreened: true, ofacMatchFound: true, ofacScreenedAt: new Date(), ofacMatches: ofacResult.matches },
          create: {
            beneficiaryId: expense.requestedById,
            organizationId,
            ofacScreened: true,
            ofacMatchFound: true,
            ofacScreenedAt: new Date(),
            ofacMatches: ofacResult.matches,
            eligibilityStatus: "INELIGIBLE_WARRANT",
          },
        });

        // Audit log for OFAC block
        await prisma.auditLog.create({
          data: {
            userId: session.user.id,
            organizationId,
            action: "ofac_screening_blocked",
            entityType: "card_issuance",
            entityId: expense.id,
            newValue: JSON.parse(JSON.stringify({ beneficiaryId: expense.requestedById, matches: ofacResult.matches })),
          },
        });

        return NextResponse.json(
          { error: "Card issuance blocked: OFAC sanctions match detected. Please contact compliance." },
          { status: 403 },
        );
      }

      // Record successful screening
      await prisma.cardholderEligibility.upsert({
        where: { beneficiaryId: expense.requestedById },
        update: { ofacScreened: true, ofacMatchFound: false, ofacScreenedAt: new Date() },
        create: {
          beneficiaryId: expense.requestedById,
          organizationId,
          ofacScreened: true,
          ofacMatchFound: false,
          ofacScreenedAt: new Date(),
          eligibilityStatus: "PENDING_VERIFICATION",
        },
      });
    }

    // Get grant-level MCC controls
    const grant = await prisma.grant.findUnique({
      where: { id: expense.grantId },
      select: { blockedMCCs: true, approvedMCCs: true, benefitFlags: true },
    });

    const blockedCategories: string[] = [];

    // Add grant-level blocked MCCs
    if (grant?.blockedMCCs && Array.isArray(grant.blockedMCCs)) {
      blockedCategories.push(...grant.blockedMCCs);
    }

    // Add global blocked MCCs from mcc-controls
    blockedCategories.push(...Object.keys(BLOCKED_MCC_CODES));

    // Create Stripe Issuing cardholder + card
    let stripeCard;
    try {
      // Fetch full beneficiary profile for KYC compliance
      const beneficiary = await prisma.user.findUnique({
        where: { id: expense.requestedById },
        select: {
          firstName: true,
          lastName: true,
          email: true,
          dateOfBirth: true,
          addressStreet: true,
          addressCity: true,
          addressState: true,
          addressZip: true,
        },
      });

      if (!beneficiary) {
        return NextResponse.json(
          { error: "Beneficiary not found" },
          { status: 404 },
        );
      }

      let cardholder;

      // Check if beneficiary already has a cardholder stored
      const existingCard = await prisma.virtualCard.findFirst({
        where: {
          beneficiaryId: expense.requestedById,
          stripeCardId: { not: { startsWith: "ic_mock_" } },
        },
        select: { stripeCardId: true },
      });

      if (existingCard) {
        // Retrieve the cardholder from an existing card
        try {
          const existingStripeCard = await stripe.issuing.cards.retrieve(existingCard.stripeCardId);
          cardholder = existingStripeCard.cardholder;
        } catch {
          // Fall through to create new cardholder
        }
      }

      if (!cardholder) {
        // Create a new cardholder with full KYC identity verification
        const cardholderResult = await stripe.issuing.cardholders.create({
          type: "individual",
          name: `${beneficiary.firstName} ${beneficiary.lastName}`,
          email: beneficiary.email,
          individual: {
            first_name: beneficiary.firstName,
            last_name: beneficiary.lastName,
            dob: {
              day: beneficiary.dateOfBirth?.getDate(),
              month: beneficiary.dateOfBirth?.getMonth() + 1,
              year: beneficiary.dateOfBirth?.getFullYear(),
            },
          },
          status: "active",
          billing: {
            address: {
              line1: beneficiary.addressStreet || "On file with BenefitsSafe",
              city: beneficiary.addressCity || "Los Angeles",
              state: beneficiary.addressState || "CA",
              postal_code: beneficiary.addressZip || "90001",
              country: "US",
            },
          },
          metadata: {
            organizationId,
            beneficiaryId: expense.requestedById,
            platform: "benefitssafe",
          },
        });
        cardholder = cardholderResult;
      }

      // Create a virtual card via Stripe Issuing
      stripeCard = await stripe.issuing.cards.create({
        cardholder: typeof cardholder === "string" ? cardholder : cardholder.id,
        type: "virtual",
        currency: "usd",
        status: "active",
        spending_controls: {
          spending_limits: [
            {
              amount: Math.round(parseFloat(expense.amount.toString()) * 100), // Stripe uses cents
              interval: cardType === "monthly" ? "monthly" : "all_time",
            },
          ],
          blocked_categories: blockedCategories.length > 0 ? blockedCategories : undefined,
        },
        metadata: {
          organizationId,
          expenseId: expense.id,
          grantId: expense.grantId,
          vendorId: expense.vendorId || "",
          beneficiaryId: expense.requestedById,
          platform: "benefitssafe",
        },
      });
    } catch (stripeError) {
      console.error("Stripe card creation error:", stripeError);
      // Only allow mock cards in local development — NEVER in production
      if (process.env.NODE_ENV === "development") {
        stripeCard = {
          id: `ic_mock_${Date.now()}`,
          last4: String(Math.floor(1000 + Math.random() * 9000)),
          exp_month: 12,
          exp_year: new Date().getFullYear() + 3,
        };
      } else {
        return NextResponse.json(
          { error: "Failed to create virtual card with Stripe. Ensure Stripe Issuing is enabled on your account." },
          { status: 502 },
        );
      }
    }

    // Store card in database
    const virtualCard = await prisma.virtualCard.create({
      data: {
        organizationId,
        grantId: expense.grantId,
        expenseId: expense.id,
        vendorId: expense.vendorId,
        beneficiaryId: expense.requestedById,
        categoryId: expense.categoryId,
        stripeCardId: stripeCard.id,
        last4: stripeCard.last4 || "0000",
        expirationMonth: stripeCard.exp_month || 12,
        expirationYear: stripeCard.exp_year || 2027,
        spendingCap: parseFloat(expense.amount.toString()),
        merchantLock: expense.vendor?.name || null,
        cardType,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
      select: {
        id: true,
        last4: true,
        expirationMonth: true,
        expirationYear: true,
        spendingCap: true,
        cardType: true,
        status: true,
        merchantLock: true,
      },
    });

    // Update expense status to PAID
    await prisma.expenseRequest.update({
      where: { id: expense.id },
      data: { status: "PAID" },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        organizationId,
        action: "issue_card",
        entityType: "virtual_card",
        entityId: virtualCard.id,
        newValue: JSON.parse(JSON.stringify({
          expenseId: expense.id,
          vendorName: expense.vendor?.name,
          beneficiary: `${expense.requestedBy.firstName} ${expense.requestedBy.lastName}`,
          last4: virtualCard.last4,
          spendingCap: virtualCard.spendingCap,
          cardType,
        })),
      },
    });

    // Increment usage counter for this month
    await incrementUsage(organizationId, "cardsIssued");

    // Fire workflow automation (non-blocking)
    import("@/lib/workflow-engine").then(({ getWorkflowEngine }) => {
      getWorkflowEngine().fire(organizationId, "card_issued", {
        cardId: virtualCard.id,
        beneficiaryName: `${expense.requestedBy.firstName} ${expense.requestedBy.lastName}`,
        beneficiaryEmail: expense.requestedBy.email,
        last4: virtualCard.last4 || "****",
        spendingLimit: parseFloat(virtualCard.spendingCap.toString()),
        grantName: expense.grant?.name || "",
      });
    }).catch(() => {});

    // Notify beneficiary about new card
    if (expense.requestedById) {
      await prisma.notification.create({
        data: {
          userId: expense.requestedById,
          organizationId,
          type: "card_issued",
          entityId: virtualCard.id,
          title: "New virtual card issued",
          message: `A new ${virtualCard.cardType} virtual card has been issued for ${expense.vendor?.name || "this purchase"}. Card ending in ${virtualCard.last4}. Spending limit: $${parseFloat(virtualCard.spendingCap.toString()).toFixed(2)}.`,
          href: `/virtual-cards/${virtualCard.id}`,
        },
      });
    }

    // Notify organization admins
    const admins = await prisma.user.findMany({
      where: {
        organizationId,
        role: {
          in: ["nonprofit_admin", "platform_admin"],
        },
      },
      select: { id: true },
    });

    for (const admin of admins) {
      await prisma.notification.create({
        data: {
          userId: admin.id,
          organizationId,
          type: "card_issued_admin",
          entityId: virtualCard.id,
          title: `Card issued for ${expense.requestedBy.firstName} ${expense.requestedBy.lastName}`,
          message: `Virtual card issued to ${expense.requestedBy.firstName} ${expense.requestedBy.lastName} for ${expense.vendor?.name || "expense"}. Amount: $${parseFloat(virtualCard.spendingCap.toString()).toFixed(2)}.`,
          href: `/virtual-cards/${virtualCard.id}`,
        },
      });
    }

    return NextResponse.json({
      message: "Virtual card issued",
      card: virtualCard,
    }, { status: 201 });
  } catch (error) {
    console.error("POST /api/expenses/[id]/issue-card error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

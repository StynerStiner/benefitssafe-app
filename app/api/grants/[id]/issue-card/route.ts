// @ts-nocheck
// POST /api/grants/[id]/issue-card — Issue a virtual card directly from a grant
// ORG-SCOPED, ORG-ISOLATED at the card level

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import {
  stripeCircuit,
  CircuitOpenError,
  CircuitTimeoutError,
  CIRCUIT_OPEN_COOLDOWN_MS,
} from "@/lib/stripe-circuit";
import { assertDbHealthy, DbUnavailableError } from "@/lib/db-health";
import { errorResponse } from "@/lib/error-response";
import { rateLimit, RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";
import { stripeIdempotencyKey } from "@/lib/stripe-idempotency";
import { checkLimitAccess, buildLimitReachedResponse, getCurrentPeriod } from "@/lib/feature-gates";
import { incrementUsage } from "@/lib/usage-tracker";
import { screenAgainstOFAC, OFACScreeningError } from "@/lib/ofac-screening";
import { BLOCKED_MCC_CODES } from "@/lib/mcc-controls";
import { sendEmail } from "@/lib/services/email-service";
import { buildCardIssuedEmail } from "@/lib/services/email-templates";
import { getIssuingAccount } from "@/lib/stripe-helpers";
import { NextResponse } from "next/server";
import { z } from "zod";

const ROUTE = "api/grants/[id]/issue-card:POST";

// Platform Treasury Financial Account id — used for the balance precheck
// when issuing cards on the platform account. Confirmed in STRIPE.md.
const PLATFORM_FINANCIAL_ACCOUNT_ID =
  "fa_65UQyXBXwWXIKG7eb8f16UQxkH04SQjPoQwtpHcXKEaX5M";

const issueCardSchema = z.object({
  beneficiaryId: z.string().min(1, "Beneficiary ID is required"),
  cardLabel: z.string().optional(),
  cardType: z.enum(["one_time", "monthly"]).default("one_time"),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await assertDbHealthy();
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
      select: { stripeAccountId: true, stripeFinancialAccountId: true },
    });
    if (!org?.stripeAccountId) {
      return NextResponse.json(
        { error: "Connect your bank account before issuing cards. Go to Organization Settings > Funding to connect." },
        { status: 400 },
      );
    }

    // Decide whether to issue on the nonprofit's connected account (if it
    // has card_issuing granted) or fall back to the platform account.
    // Stripe has not yet underwritten card_issuing on any connected
    // account — see STRIPE.md — so today every tenant lands in platform
    // mode. When Stripe grants the capability, the next card for that
    // tenant automatically switches to connected mode.
    const issuing = await getIssuingAccount(org.stripeAccountId);
    const stripeOpts = issuing.accountId ? { stripeAccount: issuing.accountId } : {};

    // Balance precheck. The Financial Account we check depends on which
    // account the card will be issued on:
    //   - connected mode → the tenant's own Treasury FA
    //   - platform mode  → the BenefitsSafe platform's Treasury FA
    // Failures here are logged but non-blocking — Stripe will decline at
    // authorization time if the balance is actually zero, and a
    // diagnostic failure shouldn't keep an admin from issuing a card.
    try {
      if (issuing.mode === "connected" && org.stripeFinancialAccountId && !org.stripeFinancialAccountId.startsWith("fa_mock_")) {
        const fa = await stripeCircuit.run(
          `${ROUTE}:stripe.treasury.financialAccounts.retrieve:connected`,
          { mode: "read" },
          () => stripe.treasury.financialAccounts.retrieve(
            org.stripeFinancialAccountId,
            { stripeAccount: issuing.accountId! },
          ),
        );
        const availableCash = fa.balance?.cash?.usd || 0;
        if (availableCash <= 0) {
          return NextResponse.json(
            {
              error: "Your organization's Treasury account has no funds. Add funds before issuing cards.",
              href: "/org-settings",
            },
            { status: 400 },
          );
        }
      } else if (issuing.mode === "platform") {
        const fa = await stripeCircuit.run(
          `${ROUTE}:stripe.treasury.financialAccounts.retrieve:platform`,
          { mode: "read" },
          () => stripe.treasury.financialAccounts.retrieve(
            PLATFORM_FINANCIAL_ACCOUNT_ID,
          ),
        );
        const availableCash = fa.balance?.cash?.usd || 0;
        if (availableCash <= 0) {
          return NextResponse.json(
            {
              error: "The BenefitsSafe platform funding account is temporarily unavailable. Please try again shortly or contact support.",
            },
            { status: 503 },
          );
        }
      }
    } catch (balanceErr) {
      // Pattern β: bubble circuit errors to outer catch for 503 mapping.
      if (balanceErr instanceof CircuitOpenError || balanceErr instanceof CircuitTimeoutError) throw balanceErr;
      console.error("[grants/issue-card] Balance precheck failed:", balanceErr);
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

    const { id: grantId } = await params;
    const body = await request.json();
    const parsed = issueCardSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { beneficiaryId, cardLabel, cardType } = parsed.data;

    // Fetch grant with org isolation
    const grant = await prisma.grant.findFirst({
      where: {
        id: grantId,
        organizationId,
      },
      select: {
        id: true,
        name: true,
        organizationId: true,
        status: true,
        remainingAmount: true,
        blockedMCCs: true,
        approvedMCCs: true,
        benefitFlags: true,
      },
    });

    if (!grant) {
      return NextResponse.json(
        { error: "Grant not found or not in your organization" },
        { status: 404 },
      );
    }

    if (grant.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Grant must be ACTIVE to issue cards" },
        { status: 400 },
      );
    }

    // Existence check for double-issue prevention. The partial unique
    // index `uniq_active_card_per_grant_beneficiary` applied via
    // scripts/add-virtual-card-unique-constraints.ts enforces this at
    // the DB level, but we check first so the happy path returns a
    // clean 409 instead of relying on P2002 at INSERT time. (DDIA Ch7
    // Transaction Safety audit.)
    const existingActiveCard = await prisma.virtualCard.findFirst({
      where: {
        grantId,
        beneficiaryId,
        status: "ACTIVE",
      },
      select: { id: true, last4: true },
    });
    if (existingActiveCard) {
      return NextResponse.json(
        {
          error: "An active card already exists for this beneficiary on this grant",
          existingCardId: existingActiveCard.id,
        },
        { status: 409 },
      );
    }

    // Check beneficiary eligibility
    const eligibility = await prisma.cardholderEligibility.findUnique({
      where: { beneficiaryId },
      select: { eligibilityStatus: true },
    });

    if (eligibility?.eligibilityStatus === "INELIGIBLE_WARRANT" ||
        eligibility?.eligibilityStatus === "INELIGIBLE_INCARCERATED") {
      return NextResponse.json(
        { error: `Cannot issue card: beneficiary is ${eligibility.eligibilityStatus === "INELIGIBLE_WARRANT" ? "ineligible due to active warrant" : "currently incarcerated"}` },
        { status: 403 },
      );
    }

    if (!eligibility) {
      // Auto-create eligibility record when admin issues card (implicit approval)
      await prisma.cardholderEligibility.create({
        data: {
          beneficiaryId,
          organizationId,
          eligibilityStatus: "ELIGIBLE",
        },
      });
    } else if (eligibility.eligibilityStatus === "PENDING_VERIFICATION") {
      return NextResponse.json(
        { error: "Beneficiary eligibility is pending verification. Please complete the eligibility check first." },
        { status: 400 },
      );
    }

    // Get beneficiary profile for KYC compliance — scoped to org to prevent IDOR
    const beneficiary = await prisma.user.findFirst({
      where: { id: beneficiaryId, organizationId, role: "beneficiary" },
      select: {
        id: true,
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
        { error: "Beneficiary not found in your organization" },
        { status: 404 },
      );
    }

    // OFAC sanctions screening — DDIA Ch8 fail-CLOSED on network error.
    let ofacResult;
    try {
      ofacResult = await screenAgainstOFAC(beneficiary.firstName, beneficiary.lastName);
    } catch (err) {
      if (err instanceof OFACScreeningError) {
        return NextResponse.json(
          { error: "OFAC screening service temporarily unavailable. Please try again in a few minutes." },
          { status: 503 },
        );
      }
      throw err;
    }

    if (ofacResult.matchFound) {
      // Update eligibility record
      await prisma.cardholderEligibility.upsert({
        where: { beneficiaryId },
        update: { ofacScreened: true, ofacMatchFound: true, ofacScreenedAt: new Date(), ofacMatches: ofacResult.matches },
        create: {
          beneficiaryId,
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
          userId,
          organizationId,
          action: "ofac_screening_blocked",
          entityType: "card_issuance",
          entityId: grantId,
          newValue: JSON.parse(JSON.stringify({ beneficiaryId, matches: ofacResult.matches })),
        },
      });

      return NextResponse.json(
        { error: "Card issuance blocked: OFAC sanctions match detected. Please contact compliance." },
        { status: 403 },
      );
    }

    // Record successful screening
    await prisma.cardholderEligibility.upsert({
      where: { beneficiaryId },
      update: { ofacScreened: true, ofacMatchFound: false, ofacScreenedAt: new Date() },
      create: {
        beneficiaryId,
        organizationId,
        ofacScreened: true,
        ofacMatchFound: false,
        ofacScreenedAt: new Date(),
        eligibilityStatus: "PENDING_VERIFICATION",
      },
    });

    // Build blocked categories list
    const blockedCategories: string[] = [];

    // Add grant-level blocked MCCs
    if (grant.blockedMCCs && Array.isArray(grant.blockedMCCs)) {
      blockedCategories.push(...grant.blockedMCCs);
    }

    // Add global blocked MCCs from mcc-controls
    blockedCategories.push(...Object.keys(BLOCKED_MCC_CODES));

    // Create Stripe Issuing cardholder + card
    let stripeCard;
    try {
      let cardholder;

      // Check if beneficiary already has a cardholder stored in the
      // SAME ISSUING MODE for this org. Cardholders live on the Stripe
      // account that issued them — a platform-mode cardholder is
      // invisible to a connected-mode retrieve and vice versa.
      const existingCard = await prisma.virtualCard.findFirst({
        where: {
          beneficiaryId,
          organizationId,
          issuingMode: issuing.mode,
          stripeCardId: { not: { startsWith: "ic_mock_" } },
        },
        select: { stripeCardId: true },
      });

      if (existingCard) {
        try {
          const existingStripeCard = await stripeCircuit.run(
            `${ROUTE}:stripe.issuing.cards.retrieve`,
            { mode: "read" },
            () => stripe.issuing.cards.retrieve(
              existingCard.stripeCardId,
              stripeOpts,
            ),
          );
          cardholder = existingStripeCard.cardholder;
        } catch (retrieveErr) {
          // Pattern β: bubble circuit errors up to the outer catch.
          if (retrieveErr instanceof CircuitOpenError || retrieveErr instanceof CircuitTimeoutError) throw retrieveErr;
          // Fall through to create new cardholder
        }
      }

      if (!cardholder) {
        // Create a new cardholder with full KYC identity verification.
        // Idempotency key ties the cardholder to (beneficiary, org, mode)
        // so retries and races converge on a single KYC record.
        // (DDIA Ch7 Transaction Safety audit.)
        const cardholderResult = await stripeCircuit.run(
          `${ROUTE}:stripe.issuing.cardholders.create`,
          { mode: "write" },
          () => stripe.issuing.cardholders.create({
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
              beneficiaryId,
              platform: "benefitssafe",
              issuingMode: issuing.mode,
            },
          }, {
            ...stripeOpts,
            idempotencyKey: stripeIdempotencyKey("cardholder", beneficiaryId, issuing.mode, organizationId),
          }),
        );
        cardholder = cardholderResult;
      }

      // Calculate spending limit from grant remaining amount
      const remainingCents = Math.round(parseFloat(grant.remainingAmount.toString()) * 100);

      // Create the virtual card via Stripe Issuing on whichever account
      // getIssuingAccount chose. Always tag metadata with organizationId
      // so platform-mode cards can still be attributed to a tenant from
      // the Stripe side (reports, webhooks, reconciliation).
      //
      // Deterministic idempotency key: (grant, beneficiary, mode). Same
      // double-click → same Stripe card, not two. Combined with the
      // partial unique index `uniq_active_card_per_grant_beneficiary`
      // applied via scripts/add-virtual-card-unique-constraints.ts this
      // guarantees exactly-once issuance per (grant, beneficiary). (DDIA
      // Ch7 Transaction Safety audit.)
      stripeCard = await stripeCircuit.run(
        `${ROUTE}:stripe.issuing.cards.create`,
        { mode: "write" },
        () => stripe.issuing.cards.create({
          cardholder: typeof cardholder === "string" ? cardholder : cardholder.id,
          type: "virtual",
          currency: "usd",
          status: "active",
          spending_controls: {
            spending_limits: [
              {
                amount: remainingCents,
                interval: cardType === "monthly" ? "monthly" : "all_time",
              },
            ],
            blocked_categories: blockedCategories.length > 0 ? blockedCategories : undefined,
          },
          metadata: {
            organizationId,
            grantId: grant.id,
            beneficiaryId,
            platform: "benefitssafe",
            issuingMode: issuing.mode,
          },
        }, {
          ...stripeOpts,
          idempotencyKey: stripeIdempotencyKey("card-grant", grantId, beneficiaryId, issuing.mode),
        }),
      );
    } catch (stripeError) {
      // Pattern β: bubble circuit errors to outer catch for 503 mapping.
      // Without this, circuit open would fall into the dev-mock or
      // prod-502 branches below — wrong UX for a transient outage.
      if (stripeError instanceof CircuitOpenError || stripeError instanceof CircuitTimeoutError) throw stripeError;
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

    // Persist the card + audit log in a single $transaction. If the
    // partial unique index `uniq_active_card_per_grant_beneficiary`
    // rejects the insert because a concurrent request already issued an
    // ACTIVE card for this (grant, beneficiary), we compensate by
    // canceling the Stripe card we just created so no orphan remains.
    // (DDIA Ch7 Transaction Safety audit.)
    let virtualCard;
    try {
      virtualCard = await prisma.$transaction(async (tx) => {
        const card = await tx.virtualCard.create({
          data: {
            organizationId,
            grantId,
            beneficiaryId,
            stripeCardId: stripeCard.id,
            issuingMode: issuing.mode,
            last4: stripeCard.last4 || "0000",
            expirationMonth: stripeCard.exp_month || 12,
            expirationYear: stripeCard.exp_year || 2027,
            spendingCap: parseFloat(grant.remainingAmount.toString()),
            cardType,
            cardLabel: cardLabel || null,
          },
          select: {
            id: true,
            last4: true,
            expirationMonth: true,
            expirationYear: true,
            spendingCap: true,
            cardType: true,
            cardLabel: true,
            status: true,
          },
        });

        await tx.auditLog.create({
          data: {
            userId,
            organizationId,
            action: "issue_card",
            entityType: "virtual_card",
            entityId: card.id,
            newValue: JSON.parse(JSON.stringify({
              grantId: grant.id,
              grantName: grant.name,
              beneficiary: `${beneficiary.firstName} ${beneficiary.lastName}`,
              beneficiaryId,
              last4: card.last4,
              spendingCap: card.spendingCap,
              cardType,
              cardLabel: cardLabel || null,
              stripeCardId: stripeCard.id,
            })),
          },
        });

        return card;
      });
    } catch (txErr) {
      // Compensate: cancel the Stripe card to avoid orphan on Stripe.
      if (stripeCard.id && !stripeCard.id.startsWith("ic_mock_")) {
        try {
          await stripeCircuit.run(
            `${ROUTE}:stripe.issuing.cards.update:compensate`,
            { mode: "write" },
            () => stripe.issuing.cards.update(
              stripeCard.id,
              { status: "canceled" },
              stripeOpts,
            ),
          );
        } catch (cancelErr) {
          // Pattern β: bubble circuit errors to outer catch for 503.
          if (cancelErr instanceof CircuitOpenError || cancelErr instanceof CircuitTimeoutError) throw cancelErr;
          console.error(
            "[grants/issue-card] compensation failed — orphan Stripe card:",
            stripeCard.id,
            cancelErr,
          );
        }
      }
      const prismaErr = txErr as { code?: string; message?: string };
      if (prismaErr.code === "P2002" || /unique/i.test(prismaErr.message || "")) {
        return NextResponse.json(
          { error: "An active card already exists for this beneficiary on this grant" },
          { status: 409 },
        );
      }
      throw txErr;
    }

    // Increment usage counter for this month (cosmetic; outside tx is OK)
    await incrementUsage(organizationId, "cardsIssued");

    // Fire workflow automation (non-blocking)
    import("@/lib/workflow-engine").then(({ getWorkflowEngine }) => {
      getWorkflowEngine().fire(organizationId, "card_issued", {
        cardId: virtualCard.id,
        beneficiaryName: `${beneficiary.firstName} ${beneficiary.lastName}`,
        beneficiaryEmail: beneficiary.email,
        last4: virtualCard.last4 || "****",
        spendingLimit: parseFloat(virtualCard.spendingCap.toString()),
        grantName: grant.name,
      });
    }).catch(() => {});

    // Notify beneficiary about new card (in-app + email)
    await prisma.notification.create({
      data: {
        userId: beneficiaryId,
        organizationId,
        type: "card_issued",
        entityId: virtualCard.id,
        title: "New virtual card issued",
        message: `A new ${virtualCard.cardType} virtual card has been issued for grant "${grant.name}". Card ending in ${virtualCard.last4}. Spending limit: $${parseFloat(virtualCard.spendingCap.toString()).toFixed(2)}.`,
        href: `/virtual-cards/${virtualCard.id}`,
      },
    });

    if (beneficiary.email) {
      const baseUrl = process.env.NEXTAUTH_URL || "https://app.benefitssafe.com";
      const tmpl = buildCardIssuedEmail({
        firstName: beneficiary.firstName,
        orgName: session.user.organizationName,
        cardLabel: cardLabel || `Card ending ${virtualCard.last4}`,
        grantName: grant.name,
        spendingLimit: `$${parseFloat(virtualCard.spendingCap.toString()).toFixed(2)}`,
        dashboardUrl: `${baseUrl}/virtual-cards`,
      });
      sendEmail({
        to: beneficiary.email,
        subject: tmpl.subject,
        html: tmpl.html,
        text: tmpl.text,
        orgName: session.user.organizationName,
        userId: beneficiaryId,
        organizationId,
        emailType: "card_issued",
      }).catch((err) => console.error("[card_issued email] failed:", err));
    }

    // Notify organization admins — in-app only.
    // No email: the admin who issued the card already knows they did it,
    // and other admins can see the activity in the dashboard. An email
    // per card issuance is pure noise.
    const admins = await prisma.user.findMany({
      where: {
        organizationId,
        role: {
          in: ["nonprofit_admin", "platform_admin"],
        },
        isActive: true,
      },
      select: { id: true },
    });

    const adminTitle = `Card issued for ${beneficiary.firstName} ${beneficiary.lastName}`;
    const adminMessage = `Virtual card issued to ${beneficiary.firstName} ${beneficiary.lastName} for grant "${grant.name}". Spending limit: $${parseFloat(virtualCard.spendingCap.toString()).toFixed(2)}.`;

    for (const admin of admins) {
      await prisma.notification.create({
        data: {
          userId: admin.id,
          organizationId,
          type: "card_issued_admin",
          entityId: virtualCard.id,
          title: adminTitle,
          message: adminMessage,
          href: `/virtual-cards/${virtualCard.id}`,
        },
      });
    }

    return NextResponse.json({
      message: "Virtual card issued",
      card: virtualCard,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof DbUnavailableError) {
      return errorResponse({
        kind: "dependency_unavailable",
        message: "Aurora is currently unavailable; please retry.",
        route: ROUTE,
        method: "POST",
        retryAfterSeconds: Math.ceil(error.cooldown_ms_remaining / 1000),
        cause: error,
      });
    }
    if (error instanceof CircuitOpenError || error instanceof CircuitTimeoutError) {
      const retryAfterSeconds =
        error instanceof CircuitOpenError
          ? Math.ceil(error.cooldown_ms_remaining / 1000)
          : Math.ceil(CIRCUIT_OPEN_COOLDOWN_MS / 1000);
      return errorResponse({
        kind: "dependency_unavailable",
        message: "Stripe is currently unavailable; please retry.",
        route: ROUTE,
        method: "POST",
        retryAfterSeconds,
        cause: error,
      });
    }
    console.error("POST /api/grants/[id]/issue-card error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

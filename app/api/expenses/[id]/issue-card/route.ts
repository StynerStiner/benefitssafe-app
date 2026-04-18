// @ts-nocheck
// POST /api/expenses/[id]/issue-card — Issue a virtual card for an approved expense
// ORG-SCOPED, ORG-ISOLATED at the card level

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { errorResponse } from "@/lib/error-response";
import { stripe } from "@/lib/stripe";
import {
  stripeCircuit,
  CircuitOpenError,
  CircuitTimeoutError,
  CIRCUIT_OPEN_COOLDOWN_MS,
} from "@/lib/stripe-circuit";
import { rateLimit, RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";
import { checkLimitAccess, buildLimitReachedResponse, getCurrentPeriod } from "@/lib/feature-gates";
import { incrementUsage } from "@/lib/usage-tracker";
import { screenAgainstOFAC, OFACScreeningError } from "@/lib/ofac-screening";
import { BLOCKED_MCC_CODES } from "@/lib/mcc-controls";
import { sendEmail } from "@/lib/services/email-service";
import { buildCardIssuedEmail } from "@/lib/services/email-templates";
import { getIssuingAccount } from "@/lib/stripe-helpers";
import { NextResponse } from "next/server";
import { z } from "zod";

const ROUTE = "api/expenses/[id]/issue-card:POST";

// Platform Treasury Financial Account id — balance precheck target
// when cards are issued in platform mode. See STRIPE.md.
const PLATFORM_FINANCIAL_ACCOUNT_ID =
  "fa_65UQyXBXwWXIKG7eb8f16UQxkH04SQjPoQwtpHcXKEaX5M";

const APP_BASE_URL =
  process.env.NEXTAUTH_URL || "https://app.benefitssafe.com";

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
      return errorResponse({
        kind: "unauthorized",
        message: "Unauthorized",
        route: ROUTE,
        method: "POST",
      });
    }

    const { role, organizationId, id: userId } = session.user;
    if (role !== "nonprofit_admin" && role !== "platform_admin") {
      return errorResponse({
        kind: "forbidden",
        message: "Forbidden",
        route: ROUTE,
        method: "POST",
        userId,
        organizationId,
      });
    }

    // Rate limit: max 10 card issues per minute per user per org
    const rateLimitKey = `card-issue:${organizationId}:${userId}`;
    const limitResult = rateLimit(rateLimitKey, RATE_LIMIT_CONFIGS.cardIssuance);

    if (!limitResult.allowed) {
      return errorResponse({
        kind: "validation",
        message: "Rate limit exceeded",
        route: ROUTE,
        method: "POST",
        userId,
        organizationId,
        status: 429,
        extraBody: {
          message: "Too many card issuance requests. Please wait before trying again.",
          retryAfter: limitResult.resetAt,
        },
        headers: { "Retry-After": limitResult.resetAt.toISOString() },
      });
    }

    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === "sk_test_REMOVED_PLACEHOLDER") {
      return errorResponse({
        kind: "internal",
        message: "Stripe is not configured. Add STRIPE_SECRET_KEY to environment variables.",
        route: ROUTE,
        method: "POST",
        userId,
        organizationId,
        status: 503,
      });
    }

    // Gate: organization must have a connected bank account to issue cards
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { stripeAccountId: true, stripeFinancialAccountId: true },
    });
    if (!org?.stripeAccountId) {
      return errorResponse({
        kind: "validation",
        message: "Connect your bank account before issuing cards. Go to Organization Settings > Funding to connect.",
        route: ROUTE,
        method: "POST",
        userId,
        organizationId,
      });
    }

    // Hybrid routing: connected-account Issuing if available, otherwise
    // platform Issuing. See lib/stripe-helpers.ts for rationale.
    const issuing = await getIssuingAccount(org.stripeAccountId);
    const stripeOpts = issuing.accountId ? { stripeAccount: issuing.accountId } : {};

    // Balance precheck against the appropriate Financial Account.
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
          return errorResponse({
            kind: "validation",
            message: "Your organization's Treasury account has no funds. Add funds before issuing cards.",
            route: ROUTE,
            method: "POST",
            userId,
            organizationId,
            extraBody: { href: "/org-settings" },
          });
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
          return errorResponse({
            kind: "internal",
            message: "The BenefitsSafe platform funding account is temporarily unavailable. Please try again shortly or contact support.",
            route: ROUTE,
            method: "POST",
            userId,
            organizationId,
            status: 503,
          });
        }
      }
    } catch (balanceErr) {
      // Pattern β: bubble circuit errors to outer catch for 503 mapping.
      if (balanceErr instanceof CircuitOpenError || balanceErr instanceof CircuitTimeoutError) throw balanceErr;
      console.error("[expenses/issue-card] Balance precheck failed:", balanceErr);
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
      return errorResponse({
        kind: "forbidden",
        message: "Card issuance limit reached for this period",
        route: ROUTE,
        method: "POST",
        userId,
        organizationId,
        extraBody: buildLimitReachedResponse("maxCardsPerMonth", limitCheck),
      });
    }

    const { id: expenseId } = await params;
    const body = await request.json();
    const parsed = issueCardSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse({
        kind: "validation",
        message: "Validation failed",
        route: ROUTE,
        method: "POST",
        userId,
        organizationId,
        extraBody: { details: parsed.error.flatten().fieldErrors },
      });
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
      return errorResponse({
        kind: "not_found",
        message: "Approved expense not found or not in your organization",
        route: ROUTE,
        method: "POST",
        userId,
        organizationId,
      });
    }

    // Check if active card already exists
    const activeCard = expense.virtualCards.find((c) => c.status === "ACTIVE");
    if (activeCard) {
      return errorResponse({
        kind: "conflict",
        message: "An active card already exists for this expense",
        route: ROUTE,
        method: "POST",
        userId,
        organizationId,
      });
    }

    // Check cardholder eligibility before issuing
    const eligibility = await prisma.cardholderEligibility.findUnique({
      where: { beneficiaryId: expense.requestedById },
      select: { eligibilityStatus: true },
    });

    if (eligibility?.eligibilityStatus === "INELIGIBLE_WARRANT" ||
        eligibility?.eligibilityStatus === "INELIGIBLE_INCARCERATED") {
      return errorResponse({
        kind: "forbidden",
        message: `Cannot issue card: beneficiary is ${eligibility.eligibilityStatus === "INELIGIBLE_WARRANT" ? "ineligible due to active warrant" : "currently incarcerated"}`,
        route: ROUTE,
        method: "POST",
        userId,
        organizationId,
      });
    }

    if (!eligibility) {
      // Auto-create eligibility record when admin issues card (implicit approval)
      await prisma.cardholderEligibility.create({
        data: {
          beneficiaryId: expense.requestedById,
          organizationId,
          eligibilityStatus: "ELIGIBLE",
        },
      });
    } else if (eligibility.eligibilityStatus === "PENDING_VERIFICATION") {
      return errorResponse({
        kind: "validation",
        message: "Beneficiary eligibility is pending verification. Please complete the eligibility check first.",
        route: ROUTE,
        method: "POST",
        userId,
        organizationId,
      });
    }

    // OFAC sanctions screening
    const beneficiaryForOFAC = await prisma.user.findUnique({
      where: { id: expense.requestedById },
      select: { firstName: true, lastName: true },
    });

    if (beneficiaryForOFAC) {
      // DDIA Ch8 — OFAC screening is fail-CLOSED. A network/HTTP error
      // throws OFACScreeningError; we surface 503 so the client retries
      // rather than proceeding with an unscreened beneficiary (which
      // would be a regulatory violation).
      let ofacResult;
      try {
        ofacResult = await screenAgainstOFAC(beneficiaryForOFAC.firstName, beneficiaryForOFAC.lastName);
      } catch (err) {
        if (err instanceof OFACScreeningError) {
          return errorResponse({
            kind: "internal",
            message: "OFAC screening service temporarily unavailable. Please try again in a few minutes.",
            route: ROUTE,
            method: "POST",
            userId,
            organizationId,
            status: 503,
            cause: err,
          });
        }
        throw err;
      }

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

        return errorResponse({
          kind: "forbidden",
          message: "Card issuance blocked: OFAC sanctions match detected. Please contact compliance.",
          route: ROUTE,
          method: "POST",
          userId,
          organizationId,
          extraBody: { beneficiaryId: expense.requestedById },
        });
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
        return errorResponse({
          kind: "not_found",
          message: "Beneficiary not found",
          route: ROUTE,
          method: "POST",
          userId,
          organizationId,
        });
      }

      let cardholder;

      // Reuse only cardholders issued in the SAME mode for this org.
      // Cross-mode reuse would produce retrieve() 404s because cardholders
      // live on the specific Stripe account that created them.
      const existingCard = await prisma.virtualCard.findFirst({
        where: {
          beneficiaryId: expense.requestedById,
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
          // Pattern β: bubble circuit errors to the big stripe-create
          // catch, which re-throws them to the outer catch for 503.
          if (retrieveErr instanceof CircuitOpenError || retrieveErr instanceof CircuitTimeoutError) throw retrieveErr;
          // Fall through to create new cardholder
        }
      }

      if (!cardholder) {
        // Create a new cardholder with full KYC identity verification.
        //
        // Idempotency key ties the cardholder to (beneficiary, org, mode).
        // On retry Stripe returns the same cardholder instead of creating
        // a duplicate KYC record. (DDIA Ch7 Transaction Safety audit.)
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
              beneficiaryId: expense.requestedById,
              platform: "benefitssafe",
              issuingMode: issuing.mode,
            },
          }, {
            ...stripeOpts,
            idempotencyKey: `cardholder-${expense.requestedById}-${issuing.mode}-${organizationId}`,
          }),
        );
        cardholder = cardholderResult;
      }

      // Create the virtual card via Stripe Issuing on whichever account
      // getIssuingAccount chose — connected if capability is granted,
      // platform otherwise.
      //
      // Deterministic idempotency key: same expense → same card, even on
      // retry. Combined with the @@unique([expenseId]) DB constraint on
      // VirtualCard (DDIA Ch7 audit fix), this guarantees exactly-once
      // card issuance per expense regardless of double-clicks, 504
      // retries, or two nodes racing the same request.
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
            issuingMode: issuing.mode,
          },
        }, {
          ...stripeOpts,
          idempotencyKey: `card-exp-${expense.id}-${issuing.mode}`,
        }),
      );
    } catch (stripeError) {
      // Pattern β: bubble circuit errors to outer catch for 503 mapping.
      // Without this, circuit open would fall into the dev-mock or
      // prod-502 branches below — neither of which is the right UX for a
      // transient Stripe outage.
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
        return errorResponse({
          kind: "internal",
          message: "Failed to create virtual card with Stripe. Ensure Stripe Issuing is enabled on your account.",
          route: ROUTE,
          method: "POST",
          userId,
          organizationId,
          status: 502,
          cause: stripeError,
        });
      }
    }

    // Persist the card + flip expense status in a single $transaction so
    // either both succeed or neither does. The expense status transition
    // uses updateMany WHERE status='APPROVED' as a guard — a retried
    // request against an already-PAID expense fails loudly instead of
    // silently issuing a second card. If the tx fails (e.g. P2002 on
    // @@unique([expenseId]) because another request already inserted a
    // card for this expense), we compensate by canceling the Stripe card
    // we just created so no orphan remains on Stripe's side.
    // (DDIA Ch7 Transaction Safety audit.)
    let virtualCard;
    try {
      virtualCard = await prisma.$transaction(async (tx) => {
        // 1. Insert VirtualCard. The @@unique([expenseId]) constraint
        //    added to schema.prisma (DDIA Ch7 fix) means a concurrent
        //    double-click throws P2002 here — the second caller's tx
        //    rolls back and we compensate on Stripe.
        const card = await tx.virtualCard.create({
          data: {
            organizationId,
            grantId: expense.grantId,
            expenseId: expense.id,
            vendorId: expense.vendorId,
            beneficiaryId: expense.requestedById,
            categoryId: expense.categoryId,
            stripeCardId: stripeCard.id,
            issuingMode: issuing.mode,
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
            cardLabel: true,
          },
        });

        // 2. Status-guarded expense transition. If the expense is not in
        //    APPROVED (e.g. was already PAID by a concurrent request),
        //    count=0 triggers rollback.
        const statusFlip = await tx.expenseRequest.updateMany({
          where: { id: expense.id, status: "APPROVED" },
          data: { status: "PAID" },
        });
        if (statusFlip.count === 0) {
          throw new Error("expense_not_approved_at_commit");
        }

        // 3. Audit log inside the tx so it rolls back with the business op.
        await tx.auditLog.create({
          data: {
            userId: session.user.id,
            organizationId,
            action: "issue_card",
            entityType: "virtual_card",
            entityId: card.id,
            newValue: JSON.parse(JSON.stringify({
              expenseId: expense.id,
              vendorName: expense.vendor?.name,
              beneficiary: `${expense.requestedBy.firstName} ${expense.requestedBy.lastName}`,
              last4: card.last4,
              spendingCap: card.spendingCap,
              cardType,
              stripeCardId: stripeCard.id,
            })),
          },
        });

        return card;
      });
    } catch (txErr) {
      // Compensate: cancel the Stripe card we created so no orphan
      // lingers on the Stripe account. Mock cards (dev) are skipped.
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
          // Pattern β: don't suppress a circuit error here — the tx
          // failure above is already the primary response path, but we
          // want the outer catch to map to 503 if this was circuit-open.
          // (Compensation failure otherwise logs + orphan as before.)
          if (cancelErr instanceof CircuitOpenError || cancelErr instanceof CircuitTimeoutError) throw cancelErr;
          console.error(
            "[expenses/issue-card] compensation failed — orphan Stripe card:",
            stripeCard.id,
            cancelErr,
          );
        }
      }
      const prismaErr = txErr as { code?: string; message?: string };
      if (prismaErr.code === "P2002") {
        return errorResponse({
          kind: "conflict",
          message: "A card already exists for this expense",
          route: ROUTE,
          method: "POST",
          userId,
          organizationId,
          cause: txErr,
        });
      }
      if (prismaErr.message === "expense_not_approved_at_commit") {
        return errorResponse({
          kind: "conflict",
          message: "Expense is no longer in APPROVED state",
          route: ROUTE,
          method: "POST",
          userId,
          organizationId,
          cause: txErr,
        });
      }
      throw txErr;
    }

    // Increment usage counter for this month (cosmetic; outside tx is OK)
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

    // Notify beneficiary about new card (in-app + email)
    const cardSpendingLimit = `$${parseFloat(virtualCard.spendingCap.toString()).toFixed(2)}`;
    const cardLabelForEmail =
      virtualCard.cardLabel ||
      `${expense.vendor?.name || "Card"} ending ${virtualCard.last4}`;

    if (expense.requestedById) {
      await prisma.notification.create({
        data: {
          userId: expense.requestedById,
          organizationId,
          type: "card_issued",
          entityId: virtualCard.id,
          title: "New virtual card issued",
          message: `A new ${virtualCard.cardType} virtual card has been issued for ${expense.vendor?.name || "this purchase"}. Card ending in ${virtualCard.last4}. Spending limit: ${cardSpendingLimit}.`,
          href: `/virtual-cards/${virtualCard.id}`,
        },
      });

      // Fire-and-forget email to beneficiary.
      if (expense.requestedBy?.email) {
        const tmpl = buildCardIssuedEmail({
          firstName: expense.requestedBy.firstName || "there",
          orgName: session.user.organizationName,
          cardLabel: cardLabelForEmail,
          grantName: expense.grant?.name || null,
          spendingLimit: cardSpendingLimit,
          dashboardUrl: `${APP_BASE_URL}/virtual-cards`,
        });
        sendEmail({
          to: expense.requestedBy.email,
          subject: tmpl.subject,
          html: tmpl.html,
          text: tmpl.text,
          orgName: session.user.organizationName,
          userId: expense.requestedById,
          organizationId,
          emailType: "card_issued",
        }).catch((err) =>
          console.error("[expenses/issue-card beneficiary email] failed:", err),
        );
      }
    }

    // Notify organization admins — in-app only.
    // No email: the admin who issued the card already knows, and other
    // admins can see the activity in the dashboard. Email is pure noise.
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

    const adminTitle = `Card issued for ${expense.requestedBy.firstName} ${expense.requestedBy.lastName}`;
    const adminMessage = `Virtual card issued to ${expense.requestedBy.firstName} ${expense.requestedBy.lastName} for ${expense.vendor?.name || "expense"}. Amount: ${cardSpendingLimit}.`;

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
    return errorResponse({
      kind: "internal",
      message: "Internal server error",
      route: ROUTE,
      method: "POST",
      cause: error,
    });
  }
}

// @ts-nocheck
// POST /api/webhooks/stripe — Stripe Issuing JIT authorization webhook
// This is the BRAIN of BenefitsSafe: approve or decline every transaction
//
// Flow:
// 1. Card is used at merchant
// 2. Stripe sends issuing_authorization.request to this webhook
// 3. We check: correct merchant? within budget? grant active? compliance pass?
// 4. We approve or decline
// 5. If approved: Stripe pulls funds from nonprofit's bank (JIT funding)
// 6. We log to ledger + audit trail
//
// CRITICAL: BenefitsSafe NEVER holds funds. Money flows directly from
// nonprofit bank -> Stripe -> vendor. We only make the approve/decline decision.

import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { validateMCC } from "@/lib/mcc-controls";
import { NextResponse } from "next/server";

const MCC_NAMES: Record<string, string> = {
  "5921": "Liquor Stores", "5813": "Bars & Nightclubs", "7995": "Gambling",
  "5541": "Gas Stations", "6011": "ATM/Cash Withdrawal", "5812": "Restaurants",
  "5814": "Fast Food", "5651": "Clothing Stores", "7832": "Entertainment",
  "5912": "Pharmacies", "7011": "Hotels/Lodging", "4121": "Taxis/Rideshare",
  "5411": "Grocery Stores", "5422": "Meat Markets", "5441": "Candy Stores",
  "5451": "Dairy Products", "5462": "Bakeries", "5499": "Food Stores",
  "8011": "Doctors", "8021": "Dentists", "8211": "Schools",
  "8220": "Colleges/Universities", "4111": "Public Transit",
};

function categorizeDecline(failed: { reason: string }[]): string {
  const reasons = failed.map(f => f.reason.toLowerCase());
  if (reasons.some(r => r.includes("merchant") || r.includes("mcc") || r.includes("category"))) return "DECLINED_BLOCKED_CATEGORY";
  if (reasons.some(r => r.includes("whitelist") || r.includes("vendor"))) return "DECLINED_VENDOR_NOT_WHITELISTED";
  if (reasons.some(r => r.includes("remaining") || r.includes("cap") || r.includes("amount"))) return "DECLINED_INSUFFICIENT_FUNDS";
  if (reasons.some(r => r.includes("eligib") || r.includes("warrant") || r.includes("incarcerated"))) return "DECLINED_INELIGIBLE";
  return "DECLINED_OTHER";
}

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    // Verify webhook signature — REQUIRED in production
    let event;
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      if (process.env.NODE_ENV === "production") {
        console.error("STRIPE_WEBHOOK_SECRET is not set in production — rejecting webhook");
        return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
      }
      // Development only: allow unsigned payloads
      event = JSON.parse(body);
    } else if (!signature) {
      return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
    } else {
      try {
        event = stripe.webhooks.constructEvent(
          body,
          signature,
          process.env.STRIPE_WEBHOOK_SECRET,
        );
      } catch {
        console.error("Stripe webhook signature verification failed");
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
      }
    }

    switch (event.type) {
      case "issuing_authorization.request": {
        return handleAuthorizationRequest(event.data.object);
      }
      case "issuing_authorization.created": {
        return handleAuthorizationCreated(event.data.object);
      }
      case "issuing_transaction.created": {
        return handleTransactionCreated(event.data.object);
      }
      case "issuing_dispute.created": {
        return handleDisputeCreated(event.data.object);
      }
      case "issuing_dispute.updated": {
        return handleDisputeUpdated(event.data.object);
      }
      case "issuing_dispute.submitted": {
        return handleDisputeSubmitted(event.data.object);
      }
      default: {
        return NextResponse.json({ received: true });
      }
    }
  } catch (error) {
    console.error("Stripe webhook error:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}

// JIT Authorization — the core decision engine
// CRITICAL: Must respond within 2 seconds or Stripe auto-declines
async function handleAuthorizationRequest(authorization: Record<string, unknown>) {
  const startTime = Date.now();
  const card = authorization.card as Record<string, unknown>;
  const stripeCardId = card?.id as string;
  const amount = (authorization.pending_request as Record<string, unknown>)?.amount as number; // in cents
  const merchantData = authorization.merchant_data as Record<string, unknown>;

  if (!stripeCardId) {
    return NextResponse.json({ approved: false, reason: "no_card_id" });
  }

  // Find the card — ORG-ISOLATED
  const virtualCard = await prisma.virtualCard.findUnique({
    where: { stripeCardId },
    select: {
      id: true,
      organizationId: true,
      expenseId: true,
      vendorId: true,
      beneficiaryId: true,
      spendingCap: true,
      status: true,
      cardType: true,
      expiresAt: true,
      merchantLock: true,
      expense: {
        select: {
          id: true,
          grantId: true,
          categoryId: true,
          status: true,
          grant: {
            select: {
              id: true,
              status: true,
              remainingAmount: true,
              organizationId: true,
              blockedMCCs: true,
              approvedMCCs: true,
            },
          },
        },
      },
    },
  });

  if (!virtualCard) {
    console.error(`JIT: Card ${stripeCardId} not found in database`);
    return NextResponse.json({ approved: false });
  }

  // CHECKS — every one must pass
  const checks: { pass: boolean; reason: string }[] = [];

  // Check cardholder eligibility
  if (virtualCard.beneficiaryId) {
    const eligibility = await prisma.cardholderEligibility.findUnique({
      where: { beneficiaryId: virtualCard.beneficiaryId },
      select: { eligibilityStatus: true },
    });

    checks.push({
      pass: !eligibility || eligibility.eligibilityStatus === "ELIGIBLE" || eligibility.eligibilityStatus === "RESTRICTED_CALFRESH_ONLY",
      reason: eligibility ? `Eligibility: ${eligibility.eligibilityStatus}` : "Eligibility: not verified (allowed)",
    });

    // For RESTRICTED_CALFRESH_ONLY, block food merchant categories
    if (eligibility?.eligibilityStatus === "RESTRICTED_CALFRESH_ONLY") {
      const foodMCCs = ["5411", "5422", "5441", "5451", "5462", "5499"];
      const mcc = (merchantData?.category as string) || "";
      checks.push({
        pass: !foodMCCs.includes(mcc),
        reason: `CalFresh restriction: food merchant ${mcc} blocked for this cardholder`,
      });
    }
  }

  // 1. Card must be active
  checks.push({
    pass: virtualCard.status === "ACTIVE",
    reason: `Card status: ${virtualCard.status}`,
  });

  // 2. Card must not be expired
  if (virtualCard.expiresAt) {
    checks.push({
      pass: new Date() < virtualCard.expiresAt,
      reason: "Card expiration check",
    });
  }

  // 3. Amount must be within spending cap
  if (virtualCard.spendingCap) {
    const capCents = Math.round(parseFloat(virtualCard.spendingCap.toString()) * 100);
    checks.push({
      pass: amount <= capCents,
      reason: `Amount ${amount} vs cap ${capCents} cents`,
    });
  }

  // 4. Grant must be active with sufficient funds
  if (virtualCard.expense?.grant) {
    const grant = virtualCard.expense.grant;
    checks.push({
      pass: grant.status === "ACTIVE",
      reason: `Grant status: ${grant.status}`,
    });

    const remainingCents = Math.round(parseFloat(grant.remainingAmount.toString()) * 100);
    checks.push({
      pass: amount <= remainingCents,
      reason: `Grant remaining ${remainingCents} vs amount ${amount} cents`,
    });

    // ORG ISOLATION CHECK — card org must match grant org
    checks.push({
      pass: grant.organizationId === virtualCard.organizationId,
      reason: "Organization isolation check",
    });
  }

  // 5. Merchant lock check
  if (virtualCard.merchantLock && merchantData) {
    const merchantName = (merchantData.name as string || "").toLowerCase();
    const lockedTo = virtualCard.merchantLock.toLowerCase();
    checks.push({
      pass: merchantName.includes(lockedTo) || lockedTo.includes(merchantName),
      reason: `Merchant lock: ${merchantName} vs ${lockedTo}`,
    });
  }

  // 6. Merchant category code (MCC) validation
  const mcc = merchantData?.category as string | undefined;
  const beneficiary = virtualCard.beneficiaryId
    ? await prisma.user.findUnique({
        where: { id: virtualCard.beneficiaryId },
        select: { benefitPrograms: true },
      })
    : null;

  const mccValidation = validateMCC(mcc, beneficiary?.benefitPrograms || []);
  checks.push({
    pass: mccValidation.allowed,
    reason: mccValidation.reason || "Merchant category approved",
  });

  // Grant-level MCC blocking
  if (virtualCard.expense?.grant?.blockedMCCs) {
    const grantBlocked = virtualCard.expense.grant.blockedMCCs as string[];
    if (Array.isArray(grantBlocked) && mcc && grantBlocked.includes(mcc)) {
      checks.push({
        pass: false,
        reason: `Grant blocks merchant category ${mcc}`,
      });
    }
  }

  // Grant-level MCC whitelist (if set, ONLY these categories allowed)
  if (virtualCard.expense?.grant?.approvedMCCs) {
    const grantApproved = virtualCard.expense.grant.approvedMCCs as string[];
    if (Array.isArray(grantApproved) && grantApproved.length > 0 && mcc) {
      checks.push({
        pass: grantApproved.includes(mcc),
        reason: `Grant whitelist check: ${mcc} ${grantApproved.includes(mcc) ? "allowed" : "not in approved list"}`,
      });
    }
  }

  const allPassed = checks.every((c) => c.pass);
  const failedChecks = checks.filter((c) => !c.pass);

  // Log the decision — fire-and-forget so we respond to Stripe immediately
  // Stripe auto-declines if we take longer than 2 seconds
  prisma.auditLog.create({
    data: {
      userId: virtualCard.beneficiaryId || "system",
      organizationId: virtualCard.organizationId,
      action: allPassed ? "authorize_approved" : "authorize_declined",
      entityType: "transaction",
      entityId: virtualCard.id,
      newValue: JSON.parse(JSON.stringify({
        stripeCardId,
        amount: amount / 100,
        merchantName: merchantData?.name,
        merchantCategory: merchantData?.category,
        merchantCategoryName: MCC_NAMES[mcc || ""] || "Unknown",
        grantId: virtualCard.expense?.grant?.id || null,
        approved: allPassed,
        decision: allPassed ? "APPROVED" : "DECLINED",
        checks: checks.map((c) => ({ ...c })),
        failedReasons: failedChecks.map((c) => c.reason),
        declineCategory: failedChecks.length > 0 ? categorizeDecline(failedChecks) : null,
      })),
    },
  }).catch((err) => console.error("Audit log failed:", err));

  if (!allPassed) {
    console.log(`JIT DECLINED: Card ${stripeCardId}, reasons: ${failedChecks.map((c) => c.reason).join(", ")}`);
  }

  const duration = Date.now() - startTime;
  console.log(`JIT authorization: ${duration}ms, approved: ${allPassed}, card: ${stripeCardId}`);

  return NextResponse.json({ approved: allPassed });
}

// After authorization is created (approved or declined)
async function handleAuthorizationCreated(authorization: Record<string, unknown>) {
  const card = authorization.card as Record<string, unknown>;
  const stripeCardId = card?.id as string;
  const approved = authorization.approved as boolean;
  const amount = (authorization.pending_request as Record<string, unknown>)?.amount as number;
  const merchantData = authorization.merchant_data as Record<string, unknown>;

  if (!stripeCardId || !approved) return NextResponse.json({ received: true });

  const virtualCard = await prisma.virtualCard.findUnique({
    where: { stripeCardId },
    select: { id: true, organizationId: true, expense: { select: { grantId: true } } },
  });

  if (virtualCard) {
    // Check if transaction already exists (idempotency)
    const existingTx = await prisma.transaction.findUnique({
      where: { stripeTransactionId: authorization.id as string },
      select: { id: true },
    });

    if (!existingTx) {
      // Create transaction record only if it doesn't exist
      await prisma.transaction.create({
        data: {
          organizationId: virtualCard.organizationId,
          cardId: virtualCard.id,
          stripeTransactionId: authorization.id as string,
          amount: (amount || 0) / 100,
          merchantName: (merchantData?.name as string) || "Unknown",
          merchantCategory: (merchantData?.category as string) || null,
          status: "pending",
          grantId: virtualCard.expense?.grantId || null,
        },
      });
    }
  }

  return NextResponse.json({ received: true });
}

// When transaction is finalized
async function handleTransactionCreated(transaction: Record<string, unknown>) {
  const card = transaction.card as Record<string, unknown>;
  const stripeCardId = card?.id as string;
  const amount = transaction.amount as number; // negative = charge
  const merchantData = transaction.merchant_data as Record<string, unknown>;

  if (!stripeCardId) return NextResponse.json({ received: true });

  const virtualCard = await prisma.virtualCard.findUnique({
    where: { stripeCardId },
    select: {
      id: true,
      organizationId: true,
      expense: {
        select: {
          grantId: true,
          categoryId: true,
        },
      },
    },
  });

  if (virtualCard && virtualCard.expense) {
    // Check if this transaction was already processed (idempotency)
    const existingLedger = await prisma.ledgerEntry.findFirst({
      where: { reference: transaction.id as string },
      select: { id: true },
    });

    if (!existingLedger) {
      const chargeAmount = Math.abs(amount) / 100;

      // Update grant spent/remaining amounts
      await prisma.grant.update({
        where: { id: virtualCard.expense.grantId },
        data: {
          spentAmount: { increment: chargeAmount },
          remainingAmount: { decrement: chargeAmount },
        },
      });

      // Update budget category
      if (virtualCard.expense.categoryId) {
        await prisma.budgetCategory.update({
          where: { id: virtualCard.expense.categoryId },
          data: {
            spentAmount: { increment: chargeAmount },
          },
        });
      }

      // Create immutable ledger entry
      const grant = await prisma.grant.findUnique({
        where: { id: virtualCard.expense.grantId },
        select: { remainingAmount: true },
      });

      await prisma.ledgerEntry.create({
        data: {
          grantId: virtualCard.expense.grantId,
          categoryId: virtualCard.expense.categoryId,
          type: "DEBIT",
          amount: chargeAmount,
          balanceAfter: parseFloat(grant?.remainingAmount?.toString() || "0"),
          description: `Card charge: ${merchantData?.name || "Unknown merchant"}`,
          reference: transaction.id as string,
        },
      });
    }
  }

  return NextResponse.json({ received: true });
}

// Handle dispute creation (chargeback, fraud claim, etc.)
async function handleDisputeCreated(dispute: Record<string, unknown>) {
  const stripeTransactionId = (dispute.transaction as Record<string, unknown>)?.id as string;
  const amount = dispute.amount as number; // in cents
  const reason = dispute.reason as string;
  const disputeId = dispute.id as string;

  if (!stripeTransactionId) {
    return NextResponse.json({ received: true });
  }

  try {
    // Check if we already processed this dispute
    const existingDispute = await prisma.notification.findFirst({
      where: {
        entityId: disputeId,
        type: "dispute_created",
      },
      select: { id: true },
    });

    if (existingDispute) {
      return NextResponse.json({ received: true });
    }

    // Find the transaction in our system
    const transaction = await prisma.transaction.findUnique({
      where: { stripeTransactionId },
      select: {
        id: true,
        cardId: true,
        organizationId: true,
        card: {
          select: {
            beneficiaryId: true,
            vendorId: true,
          },
        },
      },
    });

    if (!transaction) {
      console.warn(`Dispute for unknown transaction: ${stripeTransactionId}`);
      return NextResponse.json({ received: true });
    }

    // Update transaction status
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        status: "disputed",
        declinedReason: reason,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        organizationId: transaction.organizationId,
        action: "dispute_created",
        entityType: "transaction",
        entityId: transaction.id,
        newValue: {
          disputeId,
          reason,
          amount: amount / 100,
          status: "open",
        },
      },
    });

    // Notify admin about dispute
    const admins = await prisma.user.findMany({
      where: {
        organizationId: transaction.organizationId,
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
          organizationId: transaction.organizationId,
          type: "dispute_created",
          entityId: disputeId,
          title: `Dispute filed on card transaction: $${(amount / 100).toFixed(2)}`,
          message: `A ${reason} dispute has been filed. Amount: $${(amount / 100).toFixed(2)}. Please review and respond within 7 days.`,
          href: `/audit-trail?filter=dispute&id=${disputeId}`,
        },
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Failed to process dispute creation:", error);
    return NextResponse.json({ received: true }); // Don't fail webhook
  }
}

// Handle dispute status updates
async function handleDisputeUpdated(dispute: Record<string, unknown>) {
  const disputeId = dispute.id as string;
  const status = dispute.status as string;

  try {
    // Check idempotency
    const existingUpdate = await prisma.auditLog.findFirst({
      where: {
        entityId: disputeId,
        action: "dispute_updated",
      },
      select: { id: true },
    });

    if (existingUpdate) {
      return NextResponse.json({ received: true });
    }

    // Create audit log for dispute update
    await prisma.auditLog.create({
      data: {
        action: "dispute_updated",
        entityType: "transaction",
        entityId: disputeId,
        newValue: {
          status,
          updatedAt: new Date().toISOString(),
        },
      },
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Failed to process dispute update:", error);
    return NextResponse.json({ received: true });
  }
}

// Handle dispute submission (evidence submitted)
async function handleDisputeSubmitted(dispute: Record<string, unknown>) {
  const disputeId = dispute.id as string;

  try {
    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: "dispute_evidence_submitted",
        entityType: "transaction",
        entityId: disputeId,
        newValue: {
          disputeId,
          submittedAt: new Date().toISOString(),
        },
      },
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Failed to process dispute submission:", error);
    return NextResponse.json({ received: true });
  }
}

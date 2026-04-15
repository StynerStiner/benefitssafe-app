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

import { invalidateDashboardCache } from "@/lib/data";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { validateMCC } from "@/lib/mcc-controls";
import { markWebhookProcessed, releaseWebhookEvent } from "@/lib/webhook-idempotency";
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
  // Track whether we committed the idempotency row so the outer catch
  // can release it and let Stripe retry. issuing_authorization.request
  // is intentionally NOT deduped (see comment below) — for that path,
  // processedEventId stays null and no release happens. (DDIA Ch5
  // Replication audit.)
  let processedEventId: string | null = null;

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

    // Idempotency: reject duplicate deliveries of the same Stripe event.
    // NOTE: issuing_authorization.request is NOT deduped here — Stripe
    // needs a fresh approve/decline decision within 2s every time it
    // retries, and the JIT handler itself is already idempotent at the
    // DB level (it re-reads the card + grant balance on every call).
    // All other event types get the full dedupe guard.
    if (event.type !== "issuing_authorization.request") {
      const { firstTime } = await markWebhookProcessed(event.id, "stripe");
      if (!firstTime) {
        return NextResponse.json({ received: true, deduped: true });
      }
      processedEventId = event.id;
    }

    switch (event.type) {
      case "issuing_authorization.request": {
        return handleAuthorizationRequest(event.data.object);
      }
      case "issuing_authorization.created": {
        return handleAuthorizationCreated(event.data.object);
      }
      // issuing_transaction.created is handled by /api/webhooks/stripe-charges
      // to avoid duplicate Transaction records. Do NOT process here.
      case "account.updated": {
        return handleAccountUpdated(event.data.object);
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
    if (processedEventId) {
      await releaseWebhookEvent(processedEventId);
    }
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

  // OFAC staleness + match enforcement at authorization time.
  //
  // DDIA Ch7 Transaction Safety audit flagged that the original code
  // only read `eligibilityStatus` and never validated when the
  // beneficiary was last screened. A person added to the SDN list after
  // their last screen would authorize fine — a real OFAC violation with
  // regulatory penalties.
  //
  // Policy: re-screens older than OFAC_STALENESS_DAYS fail closed. Any
  // previously detected OFAC match also fails closed regardless of
  // `eligibilityStatus`, so a stale "ELIGIBLE" status cannot shadow a
  // fresh match.
  const OFAC_STALENESS_DAYS = 30;
  const ofacStalenessMs = OFAC_STALENESS_DAYS * 24 * 60 * 60 * 1000;

  if (virtualCard.beneficiaryId) {
    const eligibility = await prisma.cardholderEligibility.findUnique({
      where: { beneficiaryId: virtualCard.beneficiaryId },
      select: {
        eligibilityStatus: true,
        ofacScreened: true,
        ofacMatchFound: true,
        ofacScreenedAt: true,
      },
    });

    checks.push({
      pass:
        !eligibility ||
        eligibility.eligibilityStatus === "ELIGIBLE" ||
        eligibility.eligibilityStatus === "RESTRICTED_CALFRESH_ONLY",
      reason: eligibility
        ? `Eligibility: ${eligibility.eligibilityStatus}`
        : "Eligibility: not verified (allowed)",
    });

    // OFAC match — fails closed regardless of eligibility status.
    if (eligibility?.ofacMatchFound === true) {
      checks.push({
        pass: false,
        reason: "OFAC match recorded on beneficiary — declined per compliance policy",
      });
    }

    // OFAC staleness — if ever screened, require the screen to be fresh.
    // A beneficiary who has never been screened passes this check but
    // the absent eligibility row above will have let them through only
    // if the app treats "not verified" as allowed. Flag as a soft
    // check — tighten to fail-closed if SOC 2 requires.
    if (eligibility?.ofacScreened === true && eligibility.ofacScreenedAt) {
      const age = Date.now() - eligibility.ofacScreenedAt.getTime();
      checks.push({
        pass: age <= ofacStalenessMs,
        reason:
          age > ofacStalenessMs
            ? `OFAC screen stale (${Math.floor(age / (24 * 60 * 60 * 1000))} days > ${OFAC_STALENESS_DAYS} days) — decline and re-screen required`
            : "OFAC screen fresh",
      });
    }

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
      // Invalidate dashboard roll-up for the affected org so the new
      // pending transaction appears on the admin dashboard immediately.
      // (DDIA Ch5 Replication audit.)
      await invalidateDashboardCache(virtualCard.organizationId);
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
      const grantIdForUpdate = virtualCard.expense.grantId;
      const categoryIdForUpdate = virtualCard.expense.categoryId;

      // Use a transaction with row-level lock to prevent race conditions.
      // Two concurrent charges against the same grant cannot both pass
      // the balance check (Stripe has already authorized the charge at
      // this point — we just record the settlement).
      //
      // OVERSPEND SEMANTICS (DDIA Ch7 Transaction Safety audit): unlike
      // the approve path which can refuse the debit, this is a post-
      // authorization settlement. Stripe already moved the money. We
      // MUST record the debit; refusing it would leave the ledger out
      // of sync with Stripe. When `remaining < chargeAmount` we commit
      // the debit anyway but mark `overspent: true` on the ledger entry
      // and fire an immediate critical notification to org admins so
      // they can act within the Stripe dispute window.
      let overspent = false;
      await prisma.$transaction(async (tx) => {
        // Lock the grant row for update (prevents concurrent reads)
        const lockedGrant = await tx.$queryRaw`
          SELECT "remainingAmount" FROM "Grant"
          WHERE id = ${grantIdForUpdate}
          FOR UPDATE
        ` as { remainingAmount: number }[];

        const remaining = parseFloat(String(lockedGrant[0]?.remainingAmount ?? 0));
        overspent = remaining < chargeAmount;
        if (overspent) {
          console.error(
            `[handleTransactionCreated] OVERSPEND: grant ${grantIdForUpdate} has ${remaining}, charge is ${chargeAmount}. Committing debit + alerting admins.`,
          );
        }

        // Update grant spent/remaining amounts
        await tx.grant.update({
          where: { id: grantIdForUpdate },
          data: {
            spentAmount: { increment: chargeAmount },
            remainingAmount: { decrement: chargeAmount },
          },
        });

        // Update budget category
        if (categoryIdForUpdate) {
          await tx.budgetCategory.update({
            where: { id: categoryIdForUpdate },
            data: {
              spentAmount: { increment: chargeAmount },
            },
          });
        }

        // Fetch updated balance for ledger entry
        const updatedGrant = await tx.grant.findUnique({
          where: { id: grantIdForUpdate },
          select: { remainingAmount: true },
        });

        // Create immutable ledger entry
        await tx.ledgerEntry.create({
          data: {
            grantId: grantIdForUpdate,
            categoryId: categoryIdForUpdate,
            type: "DEBIT",
            amount: chargeAmount,
            balanceAfter: updatedGrant?.remainingAmount ?? 0,
            description: overspent
              ? `OVERSPEND: Card charge: ${merchantData?.name || "Unknown merchant"} (grant went negative by $${Math.abs(Number(updatedGrant?.remainingAmount ?? 0)).toFixed(2)})`
              : `Card charge: ${merchantData?.name || "Unknown merchant"}`,
            reference: transaction.id as string,
          },
        });
      });

      // Overspend alert fan-out (outside the money tx so it never
      // blocks the settlement). Fires a critical notification to every
      // org admin so they can investigate the charge while the Stripe
      // dispute window is still open.
      if (overspent) {
        const admins = await prisma.user.findMany({
          where: {
            organizationId: virtualCard.organizationId,
            role: { in: ["nonprofit_admin", "platform_admin"] },
            isActive: true,
          },
          select: { id: true },
          take: 200,
        });
        const notificationRows = admins.map((admin) => ({
          userId: admin.id,
          organizationId: virtualCard.organizationId,
          type: "grant_overspent",
          title: "Grant overspent — review immediately",
          message: `A card charge of $${chargeAmount.toFixed(2)} at ${merchantData?.name || "unknown merchant"} exceeded the remaining grant balance. The charge was already authorized by Stripe and has been committed to the ledger; dispute within 7 days if it should be reversed.`,
          entityType: "transaction",
          entityId: transaction.id as string,
          href: `/audit-trail?filter=overspend&id=${transaction.id as string}`,
        }));
        if (notificationRows.length > 0) {
          await prisma.notification
            .createMany({ data: notificationRows })
            .catch((err) =>
              console.error("[overspend alert] notify failed:", err),
            );
        }
        await prisma.auditLog
          .create({
            data: {
              userId: "system_webhook",
              organizationId: virtualCard.organizationId,
              action: "grant_overspent",
              entityType: "grant",
              entityId: grantIdForUpdate,
              newValue: {
                chargeAmount,
                merchantName: (merchantData?.name as string) || "Unknown",
                stripeTransactionId: transaction.id as string,
              },
            },
          })
          .catch((err) =>
            console.error("[overspend alert] audit failed:", err),
          );
      }

      // Fire workflow: card_transaction_completed (non-blocking)
      const grantInfo = await prisma.grant.findUnique({
        where: { id: virtualCard.expense.grantId },
        select: { name: true, totalAmount: true, remainingAmount: true },
      });
      const txBeneficiary = virtualCard.expense.requestedById
        ? await prisma.user.findUnique({
            where: { id: virtualCard.expense.requestedById },
            select: { firstName: true, lastName: true },
          })
        : null;

      if (grantInfo && txBeneficiary) {
        import("@/lib/workflow-engine").then(({ getWorkflowEngine }) => {
          const engine = getWorkflowEngine();

          // Card transaction completed
          engine.fire(virtualCard.organizationId, "card_transaction_completed", {
            transactionId: transaction.id as string,
            beneficiaryName: `${txBeneficiary.firstName} ${txBeneficiary.lastName}`,
            amount: chargeAmount,
            merchantName: (merchantData?.name as string) || "Unknown merchant",
            grantName: grantInfo.name,
            remainingBalance: parseFloat(grantInfo.remainingAmount.toString()),
          });

          // Grant low balance check (20% threshold)
          const totalAmount = parseFloat(grantInfo.totalAmount.toString());
          const remaining = parseFloat(grantInfo.remainingAmount.toString());
          const percentRemaining = totalAmount > 0 ? (remaining / totalAmount) * 100 : 100;

          if (percentRemaining < 20) {
            engine.fire(virtualCard.organizationId, "grant_low_balance", {
              grantId: virtualCard.expense.grantId,
              grantName: grantInfo.name,
              currentBalance: remaining,
              threshold: totalAmount * 0.2,
              percentRemaining: Math.round(percentRemaining),
            });
          }
        }).catch(() => {});
      }
    }
  }

  return NextResponse.json({ received: true });
}

// Handle Stripe Connect account updates (bank verification, onboarding complete, etc.)
async function handleAccountUpdated(account: Record<string, unknown>) {
  const accountId = account.id as string;
  const chargesEnabled = account.charges_enabled as boolean;
  const payoutsEnabled = account.payouts_enabled as boolean;
  const detailsSubmitted = account.details_submitted as boolean;

  if (!accountId) return NextResponse.json({ received: true });

  try {
    const org = await prisma.organization.findFirst({
      where: { stripeAccountId: accountId },
      select: { id: true },
    });

    if (!org) {
      console.log(`account.updated for unknown account ${accountId}, skipping`);
      return NextResponse.json({ received: true });
    }

    // Update org with latest Stripe Connect status
    if (chargesEnabled && payoutsEnabled && detailsSubmitted) {
      await prisma.organization.update({
        where: { id: org.id },
        data: { bankConnectedAt: new Date() },
      }).catch((err) => {
        console.error("Failed to update bankConnectedAt:", err);
      });
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: "system",
        organizationId: org.id,
        action: "stripe_account_updated",
        entityType: "organization",
        entityId: org.id,
        newValue: JSON.parse(JSON.stringify({
          stripeAccountId: accountId,
          chargesEnabled,
          payoutsEnabled,
          detailsSubmitted,
        })),
      },
    });
  } catch (error) {
    console.error("Failed to process account.updated:", error);
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
    // Rethrow so the outer POST handler releases the idempotency row and
    // returns 500 — Stripe will retry. Silently returning 200 on error
    // permanently dropped the dispute event. (DDIA Ch5 Replication audit.)
    console.error("Failed to process dispute creation:", error);
    throw error;
  }
}

// Handle dispute status updates
async function handleDisputeUpdated(dispute: Record<string, unknown>) {
  const disputeId = dispute.id as string;
  const status = dispute.status as string;
  const stripeTransactionId = (dispute.transaction as Record<string, unknown>)?.id as string;

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

    // Look up organization from the transaction
    let organizationId = "unknown";
    if (stripeTransactionId) {
      const tx = await prisma.transaction.findUnique({
        where: { stripeTransactionId },
        select: { organizationId: true },
      });
      if (tx) organizationId = tx.organizationId;
    }

    // Create audit log for dispute update
    await prisma.auditLog.create({
      data: {
        userId: "system_webhook",
        organizationId,
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
    // Rethrow so the outer POST handler returns 500 + releases idempotency.
    // (DDIA Ch5 Replication audit.)
    console.error("Failed to process dispute update:", error);
    throw error;
  }
}

// Handle dispute submission (evidence submitted)
async function handleDisputeSubmitted(dispute: Record<string, unknown>) {
  const disputeId = dispute.id as string;
  const stripeTransactionId = (dispute.transaction as Record<string, unknown>)?.id as string;

  try {
    let organizationId = "unknown";
    if (stripeTransactionId) {
      const tx = await prisma.transaction.findUnique({
        where: { stripeTransactionId },
        select: { organizationId: true },
      });
      if (tx) organizationId = tx.organizationId;
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: "system_webhook",
        organizationId,
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
    // Rethrow so the outer POST handler returns 500 + releases idempotency.
    // (DDIA Ch5 Replication audit.)
    console.error("Failed to process dispute submission:", error);
    throw error;
  }
}

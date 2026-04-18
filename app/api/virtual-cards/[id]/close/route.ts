// POST /api/virtual-cards/[id]/close — Cancel a card (ORG-SCOPED)
//
// Updates the DB status to CANCELLED AND cancels the card at Stripe via
// stripe.issuing.cards.update(stripeCardId, { status: "canceled" }).
// Without the Stripe sync a "closed" card would still authorize at
// merchants — canceled status at Stripe is irreversible, so this is the
// correct terminal action for a compromised or invalidated card.
//
// Credit-back semantics (DDIA Ch7 deferred item, fixed here):
// For cards issued against an approved expense, the expense approve
// flow has already debited the grant by `expense.amount`, and the
// card's spendingCap is set to exactly that amount (see
// /api/expenses/[id]/issue-card). That pre-debit is a *reservation*:
// we lock grant.remainingAmount to guarantee the funds are available
// when the card is charged. If the card is closed without spending its
// entire cap, the unspent portion was locked but never moved — it has
// to be returned to the grant or the funds are permanently stranded.
//
// Grant-level cards (issued directly off a grant, expenseId === null)
// are NOT eligible for credit-back: those cards never pre-debit the
// grant at issue time; the grant is debited on actual Stripe
// settlements via the /api/webhooks/stripe handleTransactionCreated
// path. There is nothing to reverse.

import { auth } from "@/auth";
import { prisma, retryOnSerializationFailure } from "@/lib/db";
import { errorResponse } from "@/lib/error-response";
import { stripe } from "@/lib/stripe";
import { stripeOptsForCard } from "@/lib/stripe-helpers";
import { NextResponse } from "next/server";
import { Prisma } from "@/lib/generated/prisma/client";

const ROUTE = "api/virtual-cards/[id]/close:POST";

// Structured error for credit-back failures inside the card-close
// $transaction. The outer catch maps this to a 400 (terminal, not
// transient) so the card is not half-closed.
class InvalidCreditBackError extends Error {
  constructor(public readonly code: string, public readonly detail: string) {
    super(detail);
  }
}

export async function POST(
  _request: Request,
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
    const { role, organizationId } = session.user;
    if (role !== "nonprofit_admin" && role !== "platform_admin") {
      return errorResponse({
        kind: "forbidden",
        message: "Forbidden",
        route: ROUTE,
        method: "POST",
        userId: session.user.id,
        organizationId,
      });
    }

    const { id } = await params;
    const card = await prisma.virtualCard.findFirst({
      where: { id, organizationId },
      select: {
        id: true,
        status: true,
        stripeCardId: true,
        issuingMode: true,
        expenseId: true,
        grantId: true,
        categoryId: true,
        spendingCap: true,
      },
    });
    if (!card) {
      return errorResponse({
        kind: "not_found",
        message: "Card not found",
        route: ROUTE,
        method: "POST",
        userId: session.user.id,
        organizationId,
      });
    }

    // stripeOptsForCard honors the card's original issuing mode.
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { stripeAccountId: true },
    });

    // Atomic DB update + audit log + credit-back. Status guard prevents
    // re-closing an already-cancelled card (which would produce phantom
    // audit entries — and, much worse under the new credit-back flow,
    // double-credit the grant). (DDIA Ch7 audit.)
    let previousStatus: string;
    let creditBackAmount = 0;
    try {
      const txResult = await retryOnSerializationFailure(() =>
        prisma.$transaction(async (tx) => {
        const updated = await tx.virtualCard.updateMany({
          where: {
            id,
            organizationId,
            status: { not: "CANCELLED" },
          },
          data: { status: "CANCELLED" },
        });
        if (updated.count === 0) {
          throw new Error("card_already_cancelled");
        }

        // Credit-back: only for expense-level cards. See the header
        // comment for why grant-level cards are skipped.
        let creditAmount = 0;
        if (card.expenseId && card.grantId && card.spendingCap) {
          const spent = await tx.transaction.aggregate({
            where: { cardId: id, status: "completed" },
            _sum: { amount: true },
          });
          const totalSpent = Number(spent._sum.amount ?? 0);
          const cap = Number(card.spendingCap);
          const unspent = cap - totalSpent;

          if (unspent > 0) {
            creditAmount = unspent;

            // Reverse the approve-time reservation on Grant. Atomic
            // conditional UPDATE with RETURNING so the credit-back and
            // the balance read are a single round-trip. The WHERE guard
            // ensures spentAmount cannot go negative even if the ledger
            // has drifted from the expected state. (DDIA Ch12 audit —
            // C-2 fix. Replaces a phantom CHECK constraint reference
            // that was never applied to the database.)
            const grantResult = await tx.$queryRaw<{ remainingAmount: Prisma.Decimal }[]>`
              UPDATE "Grant"
              SET "spentAmount"     = "spentAmount"     - ${unspent}::numeric,
                  "remainingAmount" = "remainingAmount" + ${unspent}::numeric,
                  "updatedAt"       = NOW()
              WHERE id = ${card.grantId}
                AND "organizationId" = ${organizationId}
                AND "spentAmount" >= ${unspent}::numeric
              RETURNING "remainingAmount"
            `;
            if (grantResult.length === 0) {
              throw new InvalidCreditBackError(
                "credit_back_failed",
                `Grant ${card.grantId} cannot absorb credit-back of $${unspent.toFixed(2)} (spentAmount too low or org mismatch)`,
              );
            }

            // Mirror the reversal on BudgetCategory.spentAmount so the
            // budget drill-down stays consistent with the grant top-
            // line. Expense approve incremented this by `cap`, we
            // subtract the unspent portion back out. Same atomic guard.
            if (card.categoryId) {
              const catResult = await tx.$queryRaw<{ spentAmount: Prisma.Decimal }[]>`
                UPDATE "BudgetCategory"
                SET "spentAmount" = "spentAmount" - ${unspent}::numeric,
                    "updatedAt"   = NOW()
                WHERE id = ${card.categoryId}
                  AND "organizationId" = ${organizationId}
                  AND "spentAmount" >= ${unspent}::numeric
                RETURNING "spentAmount"
              `;
              if (catResult.length === 0) {
                throw new InvalidCreditBackError(
                  "category_credit_back_failed",
                  `BudgetCategory ${card.categoryId} cannot absorb credit-back of $${unspent.toFixed(2)} (spentAmount too low or org mismatch)`,
                );
              }
            }

            // Immutable ledger entry: the credit-back is recorded as a
            // CREDIT so the grant's debit/credit history stays fully
            // reconstructable. `reference` is the card id because that
            // is the durable join key between this credit and the
            // original DEBIT written at expense approve time.
            // balanceAfter comes from the RETURNING clause above.
            await tx.ledgerEntry.create({
              data: {
                organizationId,
                grantId: card.grantId,
                categoryId: card.categoryId,
                expenseId: card.expenseId,
                type: "CREDIT",
                amount: unspent,
                balanceAfter: grantResult[0].remainingAmount,
                description: "Unspent card reservation returned on card close",
                reference: id,
              },
            });
          }
        }

        await tx.auditLog.create({
          data: {
            userId: session.user.id,
            organizationId,
            action: "close_card",
            entityType: "virtual_card",
            entityId: id,
            oldValue: JSON.parse(JSON.stringify({ status: card.status })),
            newValue: JSON.parse(
              JSON.stringify({
                status: "CANCELLED",
                creditBackAmount: creditAmount,
              }),
            ),
          },
        });

        return { previousStatus: card.status, creditAmount };
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5_000,
        timeout: 15_000,
      }),
      );
      previousStatus = txResult.previousStatus;
      creditBackAmount = txResult.creditAmount;
    } catch (err) {
      // Credit-back failed — terminal state error. Do not close the
      // card, do not retry. Return 400 so the admin can investigate.
      if (err instanceof InvalidCreditBackError) {
        return errorResponse({
          kind: "validation",
          message: err.detail,
          route: ROUTE,
          method: "POST",
          userId: session.user.id,
          organizationId,
          extraBody: { code: err.code },
          cause: err,
        });
      }
      if ((err as Error)?.message === "card_already_cancelled") {
        return errorResponse({
          kind: "conflict",
          message: "Card is already cancelled",
          route: ROUTE,
          method: "POST",
          userId: session.user.id,
          organizationId,
          cause: err,
        });
      }
      throw err;
    }

    // Cancel the card at Stripe after the DB tx commits. Dev-mode mock
    // cards (ic_mock_*) don't exist at Stripe; skip them.
    if (card.stripeCardId && !card.stripeCardId.startsWith("ic_mock_")) {
      try {
        await stripe.issuing.cards.update(
          card.stripeCardId,
          { status: "canceled" },
          stripeOptsForCard(card, org?.stripeAccountId ?? null),
        );
      } catch (stripeErr) {
        console.error(
          "[close] Stripe card cancellation failed:",
          stripeErr instanceof Error ? stripeErr.message : stripeErr,
        );
      }
    }

    return NextResponse.json({
      message: "Card closed",
      status: "CANCELLED",
      previousStatus,
      creditBackAmount,
    });
  } catch (error) {
    return errorResponse({
      kind: "internal",
      message: "Internal server error",
      route: ROUTE,
      method: "POST",
      cause: error,
    });
  }
}

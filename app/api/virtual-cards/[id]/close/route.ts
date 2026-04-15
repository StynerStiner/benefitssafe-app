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
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { stripeOptsForCard } from "@/lib/stripe-helpers";
import { NextResponse } from "next/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { role, organizationId } = session.user;
    if (role !== "nonprofit_admin" && role !== "platform_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
    if (!card) return NextResponse.json({ error: "Card not found" }, { status: 404 });

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
      const txResult = await prisma.$transaction(async (tx) => {
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

            // Reverse the approve-time reservation on Grant. We do NOT
            // use a conditional WHERE here — the expense approve path
            // already guaranteed `spentAmount >= unspent` when it
            // committed the debit (spentAmount was incremented by cap),
            // and the ledger is immutable, so the invariant cannot have
            // drifted. If it somehow has, the DB-level CHECK constraint
            // on Grant.remainingAmount (added in Ch3) will reject the
            // UPDATE and the whole close will abort.
            await tx.$executeRaw`
              UPDATE "Grant"
              SET "spentAmount"     = "spentAmount"     - ${unspent}::numeric,
                  "remainingAmount" = "remainingAmount" + ${unspent}::numeric,
                  "updatedAt"       = NOW()
              WHERE id = ${card.grantId}
            `;

            // Mirror the reversal on BudgetCategory.spentAmount so the
            // budget drill-down stays consistent with the grant top-
            // line. Expense approve incremented this by `cap`, we
            // subtract the unspent portion back out.
            if (card.categoryId) {
              await tx.$executeRaw`
                UPDATE "BudgetCategory"
                SET "spentAmount" = "spentAmount" - ${unspent}::numeric,
                    "updatedAt"   = NOW()
                WHERE id = ${card.categoryId}
              `;
            }

            // Re-read the post-update grant balance for the ledger
            // entry so balanceAfter matches what's actually in the
            // grant row at this moment — mirrors the pattern in
            // /api/expenses/[id]/approve.
            const updatedGrant = await tx.grant.findUnique({
              where: { id: card.grantId },
              select: { remainingAmount: true },
            });

            // Immutable ledger entry: the credit-back is recorded as a
            // CREDIT so the grant's debit/credit history stays fully
            // reconstructable. `reference` is the card id because that
            // is the durable join key between this credit and the
            // original DEBIT written at expense approve time.
            await tx.ledgerEntry.create({
              data: {
                organizationId,
                grantId: card.grantId,
                categoryId: card.categoryId,
                expenseId: card.expenseId,
                type: "CREDIT",
                amount: unspent,
                balanceAfter: updatedGrant?.remainingAmount ?? 0,
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
      });
      previousStatus = txResult.previousStatus;
      creditBackAmount = txResult.creditAmount;
    } catch (err) {
      if ((err as Error)?.message === "card_already_cancelled") {
        return NextResponse.json(
          { error: "Card is already cancelled" },
          { status: 409 },
        );
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
    console.error("POST /api/virtual-cards/[id]/close error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

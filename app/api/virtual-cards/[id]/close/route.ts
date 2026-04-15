// POST /api/virtual-cards/[id]/close — Cancel a card (ORG-SCOPED)
//
// Updates the DB status to CANCELLED AND cancels the card at Stripe via
// stripe.issuing.cards.update(stripeCardId, { status: "canceled" }).
// Without the Stripe sync a "closed" card would still authorize at
// merchants — canceled status at Stripe is irreversible, so this is the
// correct terminal action for a compromised or invalidated card.

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
      select: { id: true, status: true, stripeCardId: true, issuingMode: true },
    });
    if (!card) return NextResponse.json({ error: "Card not found" }, { status: 404 });

    // stripeOptsForCard honors the card's original issuing mode.
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { stripeAccountId: true },
    });

    // Atomic DB update + audit log. Status guard prevents re-closing an
    // already-cancelled card (which would produce phantom audit entries).
    // (DDIA Ch7 audit.)
    let previousStatus: string;
    try {
      previousStatus = await prisma.$transaction(async (tx) => {
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

        await tx.auditLog.create({
          data: {
            userId: session.user.id,
            organizationId,
            action: "close_card",
            entityType: "virtual_card",
            entityId: id,
            oldValue: JSON.parse(JSON.stringify({ status: card.status })),
            newValue: JSON.parse(JSON.stringify({ status: "CANCELLED" })),
          },
        });

        return card.status;
      });
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
    });
  } catch (error) {
    console.error("POST /api/virtual-cards/[id]/close error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

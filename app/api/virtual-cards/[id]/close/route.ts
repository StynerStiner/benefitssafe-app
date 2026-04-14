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
      select: { id: true, status: true, stripeCardId: true },
    });
    if (!card) return NextResponse.json({ error: "Card not found" }, { status: 404 });

    // Resolve the connected Stripe account — cards live on it.
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { stripeAccountId: true },
    });

    await prisma.virtualCard.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    // Cancel the card at Stripe so it can no longer authorize anywhere.
    // Dev-mode mock cards (ic_mock_*) don't exist at Stripe; skip them.
    if (card.stripeCardId && !card.stripeCardId.startsWith("ic_mock_") && org?.stripeAccountId) {
      try {
        await stripe.issuing.cards.update(
          card.stripeCardId,
          { status: "canceled" },
          { stripeAccount: org.stripeAccountId },
        );
      } catch (stripeErr) {
        console.error(
          "[close] Stripe card cancellation failed:",
          stripeErr instanceof Error ? stripeErr.message : stripeErr,
        );
      }
    }

    await prisma.auditLog.create({
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

    return NextResponse.json({ message: "Card closed", status: "CANCELLED" });
  } catch (error) {
    console.error("POST /api/virtual-cards/[id]/close error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

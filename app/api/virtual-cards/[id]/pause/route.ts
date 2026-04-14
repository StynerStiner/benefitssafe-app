// POST /api/virtual-cards/[id]/pause — Freeze a card (ORG-SCOPED)
//
// Updates the DB status to FROZEN AND syncs the status to Stripe by
// calling stripe.issuing.cards.update(stripeCardId, { status: "inactive" }).
// Without the Stripe sync a "frozen" card would still authorize at
// merchants — the DB flag is only consulted by our own UI, Stripe's
// authorization endpoint doesn't know about it.

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

    // Resolve the connected Stripe account — cards live on it, not on the
    // platform account.
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { stripeAccountId: true },
    });

    await prisma.virtualCard.update({
      where: { id },
      data: { status: "FROZEN" },
    });

    // Sync to Stripe — actually freeze the card at the network level so
    // subsequent issuing_authorization.request events are declined by
    // Stripe itself before they even reach our webhook. Dev-mode mock
    // cards (ic_mock_*) cannot be updated at Stripe; we log and continue.
    if (card.stripeCardId && !card.stripeCardId.startsWith("ic_mock_") && org?.stripeAccountId) {
      try {
        await stripe.issuing.cards.update(
          card.stripeCardId,
          { status: "inactive" },
          { stripeAccount: org.stripeAccountId },
        );
      } catch (stripeErr) {
        // The DB row is already FROZEN; a transient Stripe failure should
        // not roll back the user's intent. Log for manual reconciliation.
        console.error(
          "[pause] Stripe card update failed:",
          stripeErr instanceof Error ? stripeErr.message : stripeErr,
        );
      }
    }

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        organizationId,
        action: "pause_card",
        entityType: "virtual_card",
        entityId: id,
        oldValue: JSON.parse(JSON.stringify({ status: card.status })),
        newValue: JSON.parse(JSON.stringify({ status: "FROZEN" })),
      },
    });

    return NextResponse.json({ message: "Card paused", status: "FROZEN" });
  } catch (error) {
    console.error("POST /api/virtual-cards/[id]/pause error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

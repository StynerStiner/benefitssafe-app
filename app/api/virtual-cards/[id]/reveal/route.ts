// GET /api/virtual-cards/[id]/reveal — Reveal full card number, CVC, expiration
// SECURITY: Only the card's beneficiary or org admin can reveal

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import {
  stripeCircuit,
  CircuitOpenError,
  CircuitTimeoutError,
  CIRCUIT_OPEN_COOLDOWN_MS,
} from "@/lib/stripe-circuit";
import { errorResponse } from "@/lib/error-response";
import { stripeOptsForCard } from "@/lib/stripe-helpers";
import { NextResponse } from "next/server";

const ROUTE = "api/virtual-cards/[id]/reveal:GET";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: userId, role, organizationId } = session.user;
    const { id: cardId } = await params;

    // Fetch the card with org isolation
    const card = await prisma.virtualCard.findFirst({
      where: {
        id: cardId,
        organizationId,
      },
      include: {
        expense: {
          select: {
            requestedBy: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    // Look up the connected Stripe account — ephemeral keys for Issuing
    // cards must be created on the same connected account that owns the
    // card, otherwise Stripe returns "No such issuing_card".
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { stripeAccountId: true },
    });

    // Only the beneficiary who owns this card or an admin can reveal it
    if (role === "beneficiary" && card.beneficiaryId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (role !== "beneficiary" && role !== "nonprofit_admin" && role !== "platform_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Audit this sensitive action
    await prisma.auditLog.create({
      data: {
        userId,
        organizationId,
        action: "reveal_card",
        entityType: "virtual_card",
        entityId: card.id,
        newValue: { last4: card.last4, revealedBy: role },
      },
    });

    const requestedBy = card.expense?.requestedBy;
    const cardholderName = requestedBy
      ? `${requestedBy.firstName} ${requestedBy.lastName}`
      : "BENEFITSSAFE CARDHOLDER";

    // For mock cards (dev environment), return mock details
    if (card.stripeCardId.startsWith("ic_mock_")) {
      return NextResponse.json({
        number: `4242 4242 4242 ${card.last4}`,
        cvc: String(Math.floor(100 + Math.random() * 900)),
        expMonth: card.expirationMonth,
        expYear: card.expirationYear,
        cardholderName,
        brand: "Visa",
        spendingCap: card.spendingCap ? parseFloat(card.spendingCap.toString()) : null,
        merchantLock: card.merchantLock,
        status: card.status,
      });
    }

    // PCI-compliant: create an ephemeral key so the front-end can use
    // Stripe.js to display the card details in a secure Stripe-hosted
    // element. Scope to whichever account owns the card: if the card
    // was issued in "connected" mode we must pass the connected account
    // id; in "platform" mode we pass nothing and Stripe targets the
    // platform account.
    const cardStripeOpts = stripeOptsForCard(card, org?.stripeAccountId ?? null);
    const ephemeralKey = await stripeCircuit.run(
      `${ROUTE}:stripe.ephemeralKeys.create`,
      { mode: "write" },
      () => stripe.ephemeralKeys.create(
        { issuing_card: card.stripeCardId },
        { apiVersion: "2023-10-16", ...cardStripeOpts },
      ),
    );

    return NextResponse.json({
      ephemeralKey: (ephemeralKey as unknown as { secret: string }).secret,
      stripeCardId: card.stripeCardId,
      cardholderName,
      brand: "Visa",
      expMonth: card.expirationMonth,
      expYear: card.expirationYear,
      spendingCap: card.spendingCap ? parseFloat(card.spendingCap.toString()) : null,
      merchantLock: card.merchantLock,
      status: card.status,
    });
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
        method: "GET",
        retryAfterSeconds,
        cause: error,
      });
    }
    console.error("GET /api/virtual-cards/[id]/reveal error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

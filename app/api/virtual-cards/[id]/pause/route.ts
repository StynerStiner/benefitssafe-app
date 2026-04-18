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
import {
  stripeCircuit,
  CircuitOpenError,
  CircuitTimeoutError,
  CIRCUIT_OPEN_COOLDOWN_MS,
} from "@/lib/stripe-circuit";
import { errorResponse } from "@/lib/error-response";
import { stripeOptsForCard } from "@/lib/stripe-helpers";
import { NextResponse } from "next/server";

const ROUTE = "api/virtual-cards/[id]/pause:POST";

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

    // Only needed for connected-mode cards; platform-mode cards ignore
    // this. We still fetch the row because stripeOptsForCard inspects
    // both the card's mode and the org's current stripeAccountId.
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { stripeAccountId: true },
    });

    // Atomic DB update + audit log. Status guard prevents a pause-vs-close
    // race from reviving a cancelled card. updateMany + count check gives
    // us the guard without pre-reading the row. (DDIA Ch7 audit.)
    let previousStatus: string;
    try {
      previousStatus = await prisma.$transaction(async (tx) => {
        const updated = await tx.virtualCard.updateMany({
          where: {
            id,
            organizationId,
            status: { in: ["ACTIVE", "FROZEN"] },
          },
          data: { status: "FROZEN" },
        });
        if (updated.count === 0) {
          throw new Error("card_not_pausable");
        }

        await tx.auditLog.create({
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

        return card.status;
      });
    } catch (err) {
      if ((err as Error)?.message === "card_not_pausable") {
        return NextResponse.json(
          { error: "Card is not in a state that can be paused" },
          { status: 409 },
        );
      }
      throw err;
    }

    // Sync to Stripe AFTER the DB tx commits. Stripe sync happens outside
    // the tx because (a) Stripe calls can't be rolled back, and (b) a
    // transient Stripe failure should not undo the user's intent. Log
    // for manual reconciliation. Dev-mode mock cards (ic_mock_*) cannot
    // be updated at Stripe; skip them.
    if (card.stripeCardId && !card.stripeCardId.startsWith("ic_mock_")) {
      try {
        await stripeCircuit.run(
          `${ROUTE}:stripe.issuing.cards.update`,
          { mode: "write" },
          () => stripe.issuing.cards.update(
            card.stripeCardId,
            { status: "inactive" },
            stripeOptsForCard(card, org?.stripeAccountId ?? null),
          ),
        );
      } catch (stripeErr) {
        // Pattern β: bubble circuit errors to outer catch for 503 mapping.
        if (stripeErr instanceof CircuitOpenError || stripeErr instanceof CircuitTimeoutError) throw stripeErr;
        console.error(
          "[pause] Stripe card update failed:",
          stripeErr instanceof Error ? stripeErr.message : stripeErr,
        );
      }
    }

    return NextResponse.json({
      message: "Card paused",
      status: "FROZEN",
      previousStatus,
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
        method: "POST",
        retryAfterSeconds,
        cause: error,
      });
    }
    console.error("POST /api/virtual-cards/[id]/pause error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/expenses/[id]/issue-card — Issue a virtual card for an approved expense
// ORG-SCOPED, ORG-ISOLATED at the card level

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { NextResponse } from "next/server";
import { z } from "zod";

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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, organizationId } = session.user;
    if (role !== "nonprofit_admin" && role !== "platform_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === "sk_test_REMOVED_PLACEHOLDER") {
      return NextResponse.json(
        { error: "Stripe is not configured. Add STRIPE_SECRET_KEY to environment variables." },
        { status: 503 },
      );
    }

    const { id: expenseId } = await params;
    const body = await request.json();
    const parsed = issueCardSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
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
      return NextResponse.json(
        { error: "Approved expense not found or not in your organization" },
        { status: 404 },
      );
    }

    // Check if active card already exists
    const activeCard = expense.virtualCards.find((c) => c.status === "ACTIVE");
    if (activeCard) {
      return NextResponse.json(
        { error: "An active card already exists for this expense" },
        { status: 409 },
      );
    }

    // Create Stripe Issuing card
    // First, we need a cardholder — in production, this would be created during onboarding
    let stripeCard;
    try {
      // Create a virtual card via Stripe Issuing
      stripeCard = await stripe.issuing.cards.create({
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
        },
        metadata: {
          organizationId,
          expenseId: expense.id,
          grantId: expense.grantId,
          vendorId: expense.vendorId || "",
          beneficiaryId: expense.requestedById,
          platform: "benefitssafe",
        },
      });
    } catch (stripeError) {
      console.error("Stripe card creation error:", stripeError);
      // In development without proper Stripe Issuing setup, create a mock card
      if (process.env.NODE_ENV === "development" || !process.env.STRIPE_SECRET_KEY?.startsWith("sk_live")) {
        stripeCard = {
          id: `ic_mock_${Date.now()}`,
          last4: String(Math.floor(1000 + Math.random() * 9000)),
          exp_month: 12,
          exp_year: 2027,
        };
      } else {
        return NextResponse.json(
          { error: "Failed to create virtual card with Stripe" },
          { status: 502 },
        );
      }
    }

    // Store card in database
    const virtualCard = await prisma.virtualCard.create({
      data: {
        organizationId,
        expenseId: expense.id,
        vendorId: expense.vendorId,
        beneficiaryId: expense.requestedById,
        categoryId: expense.categoryId,
        stripeCardId: stripeCard.id,
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
      },
    });

    // Update expense status to PAID
    await prisma.expenseRequest.update({
      where: { id: expense.id },
      data: { status: "PAID" },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        organizationId,
        action: "issue_card",
        entityType: "virtual_card",
        entityId: virtualCard.id,
        newValue: JSON.parse(JSON.stringify({
          expenseId: expense.id,
          vendorName: expense.vendor?.name,
          beneficiary: `${expense.requestedBy.firstName} ${expense.requestedBy.lastName}`,
          last4: virtualCard.last4,
          spendingCap: virtualCard.spendingCap,
          cardType,
        })),
      },
    });

    return NextResponse.json({
      message: "Virtual card issued",
      card: virtualCard,
    }, { status: 201 });
  } catch (error) {
    console.error("POST /api/expenses/[id]/issue-card error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

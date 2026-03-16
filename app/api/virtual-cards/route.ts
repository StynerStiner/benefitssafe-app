// GET /api/virtual-cards — list cards for the organization (ORG-SCOPED)
// Also used by beneficiaries to see their own cards

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, organizationId, id: userId } = session.user;
    const isBeneficiary = role === "beneficiary";

    const cards = await prisma.virtualCard.findMany({
      where: {
        organizationId,
        ...(isBeneficiary ? { beneficiaryId: userId } : {}),
      },
      select: {
        id: true,
        last4: true,
        expirationMonth: true,
        expirationYear: true,
        spendingCap: true,
        merchantLock: true,
        cardType: true,
        status: true,
        expiresAt: true,
        createdAt: true,
        vendor: { select: { id: true, name: true, type: true } },
        expense: { select: { id: true, description: true, amount: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(cards);
  } catch (error) {
    console.error("GET /api/virtual-cards error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

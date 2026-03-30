// @ts-nocheck
// GET /api/virtual-cards — list cards for the organization (ORG-SCOPED)
// Also used by beneficiaries to see their own cards

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, organizationId, id: userId } = session.user;
    const isBeneficiary = role === "beneficiary";
    const { searchParams } = new URL(request.url);

    // Parse and validate pagination params
    const rawLimit = parseInt(searchParams.get("limit") ?? "25", 10);
    const rawOffset = parseInt(searchParams.get("offset") ?? "0", 10);
    const limit = Math.min(Math.max(Number.isNaN(rawLimit) ? 25 : rawLimit, 1), 100);
    const offset = Math.max(Number.isNaN(rawOffset) ? 0 : rawOffset, 0);

    const cardWhere = {
      organizationId,
      ...(isBeneficiary ? { beneficiaryId: userId } : {}),
    };

    const [cards, total] = await Promise.all([
      prisma.virtualCard.findMany({
        where: cardWhere,
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
          beneficiary: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
              email: true,
            },
          },
          vendor: { select: { id: true, name: true, type: true } },
          expense: { select: { id: true, description: true, amount: true } },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.virtualCard.count({ where: cardWhere }),
    ]);

    return NextResponse.json({ data: cards, total, limit, offset });
  } catch (error) {
    console.error("GET /api/virtual-cards error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

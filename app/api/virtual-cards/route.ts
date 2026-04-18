// @ts-nocheck
// GET /api/virtual-cards — list cards for the organization (ORG-SCOPED)
// Also used by beneficiaries to see their own cards

import * as Sentry from "@sentry/nextjs";
import { GuardDenial, requireAuth } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";
import { errorResponse } from "@/lib/error-response";
import { NextResponse } from "next/server";

const ROUTE = "api/virtual-cards:GET";

export async function GET(request: Request) {
  try {
    const { role, organizationId, userId } = await requireAuth(ROUTE, "GET");
    const isBeneficiary = role === "beneficiary";
    const { searchParams } = new URL(request.url);

    // Parse and validate pagination params
    const rawLimit = parseInt(searchParams.get("limit") ?? "25", 10);
    const rawOffset = parseInt(searchParams.get("offset") ?? "0", 10);
    const limit = Math.min(Math.max(Number.isNaN(rawLimit) ? 25 : rawLimit, 1), 100);
    const offset = Math.max(Number.isNaN(rawOffset) ? 0 : rawOffset, 0);

    const grantId = searchParams.get("grantId");
    const statusFilter = searchParams.get("status");

    const cardWhere = {
      organizationId,
      ...(isBeneficiary ? { beneficiaryId: userId } : {}),
      ...(grantId ? { expense: { grantId } } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
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
    if (error instanceof GuardDenial) return error.toErrorResponse();
    Sentry.captureException(error, {
      tags: { route: '/api/virtual-cards', method: 'GET' },
    });
    return errorResponse({
      kind: "internal",
      message: "Internal server error",
      route: ROUTE,
      method: "GET",
      cause: error,
    });
  }
}

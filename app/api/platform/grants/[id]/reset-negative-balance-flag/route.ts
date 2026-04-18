// POST /api/platform/grants/[id]/reset-negative-balance-flag
//
// Platform-admin escape hatch for a Grant stuck with
// allowNegativeBalance=true despite a restored balance. Every call is
// audit-logged with the operator's userId, a required reason, and the
// before/after state. See docs/runbooks/stuck-overspend-grants.md for
// when to use this vs. waiting for the auto-reset on admin refill.

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { errorResponse } from "@/lib/error-response";
import { withOrgContext } from "@/lib/org-context";
import { NextResponse } from "next/server";
import { z } from "zod";

const ROUTE = "api/platform/grants/[id]/reset-negative-balance-flag:POST";

const bodySchema = z.object({
  reason: z.string().min(10, "Reason must be at least 10 characters"),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return errorResponse({
        kind: "unauthorized",
        message: "Unauthorized",
        route: ROUTE,
        method: "POST",
      });
    }
    if (session.user.role !== "platform_admin") {
      return errorResponse({
        kind: "forbidden",
        message: "Forbidden",
        route: ROUTE,
        method: "POST",
        userId: session.user.id,
      });
    }

    return withOrgContext(
      {
        kind: "exempt",
        reason: "PLATFORM_ADMIN",
        note: "reset-negative-balance-flag",
      },
      async () => {
        const { id } = await params;
        const body = await request.json();
        const parsed = bodySchema.safeParse(body);
        if (!parsed.success) {
          return errorResponse({
            kind: "validation",
            message: parsed.error.issues[0].message,
            route: ROUTE,
            method: "POST",
            userId: session.user.id,
          });
        }

        const grant = await prisma.grant.findUnique({
          where: { id },
          select: {
            id: true,
            organizationId: true,
            allowNegativeBalance: true,
            remainingAmount: true,
          },
        });
        if (!grant) {
          return errorResponse({
            kind: "not_found",
            message: "Grant not found",
            route: ROUTE,
            method: "POST",
            userId: session.user.id,
          });
        }

        const result = await prisma.$transaction(async (tx) => {
          const updated = await tx.grant.update({
            where: { id },
            data: { allowNegativeBalance: false },
            select: {
              id: true,
              organizationId: true,
              allowNegativeBalance: true,
              remainingAmount: true,
            },
          });
          await tx.auditLog.create({
            data: {
              userId: session.user.id,
              organizationId: grant.organizationId,
              action: "reset_negative_balance_flag",
              entityType: "grant",
              entityId: id,
              oldValue: {
                allowNegativeBalance: grant.allowNegativeBalance,
                remainingAmount: Number(grant.remainingAmount),
              },
              newValue: {
                allowNegativeBalance: false,
                reason: parsed.data.reason,
                resetBy: session.user.id,
                resetAt: new Date().toISOString(),
              },
            },
          });
          return updated;
        });

        return NextResponse.json({ grant: result });
      },
    );
  } catch (error) {
    return errorResponse({
      kind: "internal",
      message: "Internal server error",
      route: ROUTE,
      method: "POST",
      cause: error,
    });
  }
}

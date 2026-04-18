// POST /api/platform/grants/[id]/reset-negative-balance-flag
//
// Platform-admin escape hatch for a Grant stuck with
// allowNegativeBalance=true despite a restored balance. Every call is
// audit-logged with the operator's userId, a required reason, and the
// before/after state. See docs/runbooks/stuck-overspend-grants.md for
// when to use this vs. waiting for the auto-reset on admin refill.

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { withOrgContext } from "@/lib/org-context";
import { NextResponse } from "next/server";
import { z } from "zod";

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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "platform_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
          return NextResponse.json(
            { error: parsed.error.issues[0].message },
            { status: 400 },
          );
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
          return NextResponse.json({ error: "Grant not found" }, { status: 404 });
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
    console.error(
      "POST /api/platform/grants/[id]/reset-negative-balance-flag error:",
      error,
    );
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

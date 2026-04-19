// ORG-SCOPED: All queries filtered by session.user.organizationId
// No cross-organization data leakage possible.

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { assertDbHealthy, DbUnavailableError } from "@/lib/db-health";
import { errorResponse } from "@/lib/error-response";
import { createBudgetCategorySchema } from "@/lib/validations/grant";
import { NextResponse } from "next/server";

const ROUTE = "api/grants/[id]/categories:POST";

// POST /api/grants/[id]/categories — add a budget category
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await assertDbHealthy();
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: grantId } = await params;
    const { role, organizationId, id: userId } = session.user;

    if (role !== "nonprofit_admin" && role !== "platform_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify grant belongs to org
    const grant = await prisma.grant.findFirst({
      where: { id: grantId, organizationId },
    });

    if (!grant) {
      return NextResponse.json({ error: "Grant not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = createBudgetCategorySchema.safeParse({
      ...body,
      grantId,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const category = await prisma.budgetCategory.create({
      data: {
        organizationId,
        grantId,
        name: data.name,
        allocatedAmount: data.allocatedAmount,
        cardMode: data.cardMode,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId,
        organizationId,
        action: "create",
        entityType: "budget_category",
        entityId: category.id,
        newValue: {
          name: category.name,
          allocatedAmount: category.allocatedAmount.toString(),
          grantId,
        },
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    if (error instanceof DbUnavailableError) {
      return errorResponse({
        kind: "dependency_unavailable",
        message: "Aurora is currently unavailable; please retry.",
        route: ROUTE,
        method: "POST",
        retryAfterSeconds: Math.ceil(error.cooldown_ms_remaining / 1000),
        cause: error,
      });
    }
    console.error("POST /api/grants/[id]/categories error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

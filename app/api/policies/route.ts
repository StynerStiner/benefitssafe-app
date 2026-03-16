import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const policy = await prisma.disbursementPolicy.findFirst({
      where: { organizationId: session.user.organizationId },
    });

    return NextResponse.json(policy);
  } catch (error) {
    console.error("GET /api/policies error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, organizationId } = session.user;
    if (role !== "nonprofit_admin" && role !== "platform_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();

    const policy = await prisma.disbursementPolicy.upsert({
      where: { id: body.id || "nonexistent" },
      update: {
        cashToRecipient: body.cashToRecipient,
        reimbursementToRecipient: body.reimbursementToRecipient,
        rentUtilityPayments: body.rentUtilityPayments,
        recurringSubscriptions: body.recurringSubscriptions,
        maxSingleTransaction: body.maxSingleTransaction,
        allowedCategories: body.allowedCategories,
        blockedCategories: body.blockedCategories,
      },
      create: {
        organizationId,
        cashToRecipient: body.cashToRecipient || "DISALLOWED",
        reimbursementToRecipient: body.reimbursementToRecipient || "DISALLOWED",
        rentUtilityPayments: body.rentUtilityPayments || "REQUIRES_REVIEW",
        recurringSubscriptions: body.recurringSubscriptions || "ALLOWED",
        maxSingleTransaction: body.maxSingleTransaction,
        allowedCategories: body.allowedCategories,
        blockedCategories: body.blockedCategories,
      },
    });

    return NextResponse.json(policy);
  } catch (error) {
    console.error("PATCH /api/policies error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

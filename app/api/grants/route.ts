// ORG-SCOPED: All queries filtered by session.user.organizationId
// No cross-organization data leakage possible.

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { createGrantSchema } from "@/lib/validations/grant";
import { NextResponse } from "next/server";

// GET /api/grants — list grants scoped to organization
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, organizationId } = session.user;

    // Beneficiaries only see their own grants
    const where =
      role === "beneficiary"
        ? { organizationId, beneficiaryId: session.user.id, archivedAt: null }
        : { organizationId, archivedAt: null };

    const grants = await prisma.grant.findMany({
      where,
      include: {
        beneficiary: { select: { id: true, firstName: true, lastName: true, email: true } },
        categories: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(grants);
  } catch (error) {
    console.error("GET /api/grants error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/grants — create a new grant
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, organizationId, id: userId } = session.user;
    if (role !== "nonprofit_admin" && role !== "platform_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createGrantSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const grant = await prisma.grant.create({
      data: {
        organizationId,
        name: data.name,
        description: data.description,
        grantIssuerName: data.grantIssuerName,
        grantIssuerContact: data.grantIssuerContact,
        beneficiaryId: data.beneficiaryId || null,
        totalAmount: data.totalAmount,
        remainingAmount: data.totalAmount,
        startDate: data.startDate,
        endDate: data.endDate,
        restrictions: data.restrictions,
        benefitFlags: data.benefitFlags ?? undefined,
        status: "ACTIVE",
      },
      include: {
        beneficiary: { select: { id: true, firstName: true, lastName: true, email: true } },
        categories: true,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId,
        organizationId,
        action: "create",
        entityType: "grant",
        entityId: grant.id,
        newValue: {
          name: grant.name,
          totalAmount: grant.totalAmount.toString(),
          grantIssuerName: grant.grantIssuerName,
        },
      },
    });

    return NextResponse.json(grant, { status: 201 });
  } catch (error) {
    console.error("POST /api/grants error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

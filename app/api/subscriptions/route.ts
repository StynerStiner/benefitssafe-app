import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { createSubscriptionSchema } from "@/lib/validations/subscription";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { organizationId, role, id: userId } = session.user;
    const params = request.nextUrl.searchParams;

    const limit = Math.min(parseInt(params.get("limit") || "25", 10) || 25, 100);
    const offset = Math.max(parseInt(params.get("offset") || "0", 10) || 0, 0);

    // Beneficiaries only see subscriptions tied to grants they are the
    // named beneficiary on. Org-scope alone would leak every other
    // beneficiary's SaaS subscriptions in the same nonprofit.
    const where =
      role === "beneficiary"
        ? { organizationId, grant: { is: { beneficiaryId: userId } } }
        : { organizationId };

    const [subscriptions, total] = await Promise.all([
      prisma.subscription.findMany({
        where,
        include: {
          vendor: { select: { id: true, name: true, type: true, status: true } },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.subscription.count({ where }),
    ]);

    return NextResponse.json({ subscriptions, total, limit, offset });
  } catch (error) {
    console.error("GET /api/subscriptions error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/subscriptions -- create a new subscription
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
    const parsed = createSubscriptionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Verify vendor belongs to org
    const vendor = await prisma.vendor.findFirst({
      where: { id: data.vendorId, organizationId, archivedAt: null },
    });
    if (!vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    // Verify grant belongs to org
    const grant = await prisma.grant.findFirst({
      where: { id: data.grantId, organizationId, archivedAt: null },
    });
    if (!grant) {
      return NextResponse.json({ error: "Grant not found" }, { status: 404 });
    }

    // Verify category belongs to grant
    const category = await prisma.budgetCategory.findFirst({
      where: { id: data.categoryId, grantId: data.grantId, organizationId },
    });
    if (!category) {
      return NextResponse.json({ error: "Budget category not found" }, { status: 404 });
    }

    const subscription = await prisma.subscription.create({
      data: {
        organizationId,
        vendorId: data.vendorId,
        grantId: data.grantId,
        categoryId: data.categoryId,
        serviceName: data.serviceName.trim(),
        loginEmail: data.loginEmail?.trim() || "",
        monthlyCost: data.monthlyCost,
        billingCycle: data.billingCycle,
        renewalDate: data.renewalDate ?? null,
        billingUpdateStatus: data.billingUpdateStatus,
        status: data.status,
      },
      include: {
        vendor: { select: { id: true, name: true, type: true, status: true } },
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId,
        organizationId,
        action: "create",
        entityType: "subscription",
        entityId: subscription.id,
        newValue: {
          serviceName: subscription.serviceName,
          monthlyCost: subscription.monthlyCost.toString(),
          vendorId: subscription.vendorId,
          grantId: subscription.grantId,
        },
      },
    });

    return NextResponse.json(subscription, { status: 201 });
  } catch (error) {
    console.error("POST /api/subscriptions error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

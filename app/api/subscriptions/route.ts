import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { organizationId } = session.user;

    const subscriptions = await prisma.subscription.findMany({
      where: {
        vendor: { organizationId },
      },
      include: {
        vendor: { select: { id: true, name: true, type: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(subscriptions);
  } catch (error) {
    console.error("GET /api/subscriptions error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/subscriptions — create a new subscription
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

    // Basic validation
    if (!body.serviceName?.trim()) {
      return NextResponse.json({ error: "Service name is required" }, { status: 400 });
    }
    if (!body.vendorId) {
      return NextResponse.json({ error: "Vendor is required" }, { status: 400 });
    }
    if (!body.grantId) {
      return NextResponse.json({ error: "Grant is required" }, { status: 400 });
    }
    if (!body.categoryId) {
      return NextResponse.json({ error: "Budget category is required" }, { status: 400 });
    }
    if (!body.monthlyCost || Number(body.monthlyCost) <= 0) {
      return NextResponse.json({ error: "Monthly cost must be a positive number" }, { status: 400 });
    }

    // Verify vendor belongs to org
    const vendor = await prisma.vendor.findFirst({
      where: { id: body.vendorId, organizationId, archivedAt: null },
    });
    if (!vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    // Verify grant belongs to org
    const grant = await prisma.grant.findFirst({
      where: { id: body.grantId, organizationId, archivedAt: null },
    });
    if (!grant) {
      return NextResponse.json({ error: "Grant not found" }, { status: 404 });
    }

    // Verify category belongs to grant
    const category = await prisma.budgetCategory.findFirst({
      where: { id: body.categoryId, grantId: body.grantId },
    });
    if (!category) {
      return NextResponse.json({ error: "Budget category not found" }, { status: 404 });
    }

    const subscription = await prisma.subscription.create({
      data: {
        vendorId: body.vendorId,
        grantId: body.grantId,
        categoryId: body.categoryId,
        serviceName: body.serviceName.trim(),
        loginEmail: body.loginEmail?.trim() || "",
        monthlyCost: Number(body.monthlyCost),
        billingCycle: body.billingCycle || "monthly",
        renewalDate: body.renewalDate ? new Date(body.renewalDate) : null,
        billingUpdateStatus: body.billingUpdateStatus || "PENDING",
        status: body.status || "ACTIVE",
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

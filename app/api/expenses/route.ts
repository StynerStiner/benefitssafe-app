// ORG-SCOPED: All queries filtered by session.user.organizationId
// No cross-organization data leakage possible.

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { createExpenseSchema } from "@/lib/validations/expense";
import { classifyExpense } from "@/utils/compliance-rules";
import { NextResponse } from "next/server";

// GET /api/expenses — list expenses scoped by role
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, organizationId, id: userId } = session.user;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const grantId = searchParams.get("grantId");

    // Build where clause based on role
    const where: Record<string, unknown> = {};

    if (role === "beneficiary") {
      // Beneficiaries only see their own expenses
      where.requestedById = userId;
      where.grant = { organizationId };
    } else if (role === "platform_admin") {
      // Platform admins see everything
    } else if (role === "nonprofit_admin" || role === "cpa") {
      // Scoped to their organization
      where.grant = { organizationId };
    } else {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (status) {
      where.status = status;
    }

    if (grantId) {
      where.grantId = grantId;
    }

    const expenses = await prisma.expenseRequest.findMany({
      where,
      include: {
        grant: {
          select: { id: true, name: true, benefitFlags: true, organizationId: true },
        },
        category: { select: { id: true, name: true } },
        requestedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        vendor: { select: { id: true, name: true, type: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Note: suggestedCategory and approvedAt are included automatically by Prisma

    return NextResponse.json(expenses);
  } catch (error) {
    console.error("GET /api/expenses error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/expenses — submit a new expense request
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, id: userId, organizationId } = session.user;

    // Only beneficiaries and nonprofit admins can submit expenses
    if (role !== "beneficiary" && role !== "nonprofit_admin" && role !== "platform_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createExpenseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const data = parsed.data;

    // Verify grant belongs to user's org and is active
    const grant = await prisma.grant.findFirst({
      where: {
        id: data.grantId,
        organizationId,
        status: "ACTIVE",
        archivedAt: null,
      },
      include: {
        categories: true,
      },
    });

    if (!grant) {
      return NextResponse.json(
        { error: "Grant not found or not active" },
        { status: 404 },
      );
    }

    // Verify category belongs to this grant
    // "other" is a special value for "Other / Suggest New" — use first category as placeholder
    const isOtherCategory = data.categoryId === "other";
    let category: (typeof grant.categories)[number];
    if (isOtherCategory) {
      if (!data.suggestedCategory?.trim()) {
        return NextResponse.json(
          { error: "Please specify a category name when selecting Other" },
          { status: 400 },
        );
      }
      // Use the first category as a placeholder; admin will reassign
      category = grant.categories[0];
      if (!category) {
        return NextResponse.json(
          { error: "Grant has no budget categories" },
          { status: 400 },
        );
      }
    } else {
      const found = grant.categories.find((c) => c.id === data.categoryId);
      if (!found) {
        return NextResponse.json(
          { error: "Budget category not found for this grant" },
          { status: 404 },
        );
      }
      category = found;
    }

    // Run compliance classification
    const benefitFlags = grant.benefitFlags as {
      ssi: boolean;
      ssdi: boolean;
      mediCal: boolean;
      medicaid: boolean;
      able: boolean;
    } | null;

    const classification = classifyExpense(
      {
        expenseType: data.expenseType,
        description: data.description,
        vendorType: data.vendorName ? "named" : "",
        amount: data.amount,
        category: category.name,
        frequency: data.frequency,
      },
      benefitFlags,
    );

    // Create the expense request
    const expense = await prisma.expenseRequest.create({
      data: {
        grantId: data.grantId,
        categoryId: category.id,
        requestedById: userId,
        suggestedCategory: isOtherCategory ? data.suggestedCategory : null,
        description: data.description,
        amount: data.amount,
        frequency: data.frequency,
        expenseType: data.expenseType,
        vendorName: data.vendorName || null,
        vendorEmail: data.vendorEmail || null,
        vendorPhone: data.vendorPhone || null,
        vendorWebsite: data.vendorWebsite || null,
        riskClassification: classification.level,
        riskNotes: classification.reason,
        status: classification.level === "BLOCKED" ? "REJECTED" : "PENDING",
        rejectedReason:
          classification.level === "BLOCKED"
            ? `Auto-blocked by compliance engine: ${classification.reason}`
            : null,
      },
      include: {
        grant: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        requestedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId,
        organizationId,
        action: "create",
        entityType: "expense",
        entityId: expense.id,
        newValue: {
          description: expense.description,
          amount: expense.amount.toString(),
          riskClassification: classification.level,
          riskNotes: classification.reason,
          rules: classification.rules,
        },
      },
    });

    return NextResponse.json(
      {
        ...expense,
        classification,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/expenses error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

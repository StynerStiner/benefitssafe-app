// ORG-SCOPED: All queries filtered by session.user.organizationId
// No cross-organization data leakage possible.

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { rateLimit, RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";
import { createExpenseSchema } from "@/lib/validations/expense";
import { classifyExpense } from "@/utils/compliance-rules";
import { checkLimitAccess, buildLimitReachedResponse, getCurrentPeriod } from "@/lib/feature-gates";
import { incrementUsage } from "@/lib/usage-tracker";
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

    // Parse and validate pagination params
    const rawLimit = parseInt(searchParams.get("limit") ?? "25", 10);
    const rawOffset = parseInt(searchParams.get("offset") ?? "0", 10);
    const limit = Math.min(Math.max(Number.isNaN(rawLimit) ? 25 : rawLimit, 1), 100);
    const offset = Math.max(Number.isNaN(rawOffset) ? 0 : rawOffset, 0);

    // Build where clause based on role
    const where: Record<string, unknown> = {};

    if (role === "beneficiary") {
      // Beneficiaries only see their own expenses
      where.requestedById = userId;
      where.grant = { is: { organizationId } };
    } else if (role === "platform_admin") {
      // Platform admins see everything
    } else if (
      role === "nonprofit_admin" ||
      role === "nonprofit_staff" ||
      role === "cpa" ||
      role === "auditor" ||
      role === "attorney" ||
      role === "compliance_officer" ||
      role === "grant_officer"
    ) {
      // Scoped to their organization (read-only for non-admin roles)
      where.grant = { is: { organizationId } };
    } else {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (status) {
      where.status = status;
    }

    if (grantId) {
      where.grantId = grantId;
    }

    const [expenses, total] = await Promise.all([
      prisma.expenseRequest.findMany({
        where,
        include: {
          grant: {
            select: { id: true, name: true, benefitFlags: true, organizationId: true },
          },
          category: { select: { id: true, name: true } },
          requestedBy: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
          virtualCards: { select: { id: true, last4: true, status: true } },
          vendor: { select: { id: true, name: true, type: true } },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.expenseRequest.count({ where }),
    ]);

    // Note: suggestedCategory and approvedAt are included automatically by Prisma

    return NextResponse.json({ data: expenses, total, limit, offset });
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

    // Beneficiaries, nonprofit admins, and staff can submit expenses
    if (role !== "beneficiary" && role !== "nonprofit_admin" && role !== "nonprofit_staff" && role !== "platform_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Rate limit: 30 requests per minute per user
    const rateLimitResult = rateLimit(
      `expense-create:${session.user.id}`,
      RATE_LIMIT_CONFIGS.expenseCreate,
    );
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((rateLimitResult.resetAt.getTime() - Date.now()) / 1000)),
            "X-RateLimit-Remaining": String(rateLimitResult.remaining),
          },
        },
      );
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

    // Plan limit gate: count this month's expenses from UsageCounter
    const period = getCurrentPeriod();
    const usage = await prisma.usageCounter.findUnique({
      where: { organizationId_period: { organizationId, period } },
      select: { expensesProcessed: true },
    });
    const currentMonthlyExpenses = usage?.expensesProcessed ?? 0;
    const limitCheck = await checkLimitAccess(
      organizationId,
      "maxExpensesPerMonth",
      currentMonthlyExpenses,
    );
    if (!limitCheck.allowed) {
      return NextResponse.json(
        buildLimitReachedResponse("maxExpensesPerMonth", limitCheck),
        { status: 403 },
      );
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
        requestedBy: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
        virtualCards: { select: { id: true, last4: true, status: true } },
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

    // Increment usage counter for this month
    await incrementUsage(organizationId, "expensesProcessed");

    // Fire workflow for flagged expenses (non-blocking)
    if (classification.level === "NEEDS_REVIEW" || classification.level === "LIKELY_RISKY") {
      import("@/lib/workflow-engine").then(({ getWorkflowEngine }) => {
        getWorkflowEngine().fire(organizationId, "transaction_needs_review", {
          transactionId: expense.id,
          beneficiaryName: `${expense.requestedBy.firstName} ${expense.requestedBy.lastName}`,
          amount: parseFloat(expense.amount.toString()),
          merchantName: expense.vendorName || "Unknown",
          mccCode: "",
          riskClassification: classification.level,
          grantName: expense.grant.name,
        });
      }).catch(() => {});
    }

    // Notify org admins about new expense submission
    const admins = await prisma.user.findMany({
      where: { organizationId, role: { in: ["nonprofit_admin", "platform_admin"] }, isActive: true },
      select: { id: true },
    });
    const submitterName = expense.requestedBy
      ? `${expense.requestedBy.firstName} ${expense.requestedBy.lastName}`
      : "A user";
    for (const admin of admins) {
      if (admin.id !== userId) {
        await prisma.notification.create({
          data: {
            userId: admin.id,
            organizationId,
            type: "expense_submitted",
            title: "New expense request submitted",
            message: `${submitterName} submitted a $${parseFloat(expense.amount.toString()).toFixed(2)} expense for "${expense.description}" (${expense.grant.name}).`,
            entityType: "expense",
            entityId: expense.id,
            href: `/expenses`,
          },
        });
      }
    }

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

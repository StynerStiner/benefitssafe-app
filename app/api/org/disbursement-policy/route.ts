// @ts-nocheck
// GET/POST /api/org/disbursement-policy — Manage the org's disbursement auto-approve policy
// ORG-SCOPED via session.organizationId

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { assertDbHealthy, DbUnavailableError } from "@/lib/db-health";
import { errorResponse } from "@/lib/error-response";
import { NextResponse } from "next/server";

const ROUTE_POST = "api/org/disbursement-policy:POST";

// GET — retrieve the org-wide disbursement policy
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { organizationId, role } = session.user;
    if (role !== "nonprofit_admin" && role !== "platform_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const policy = await prisma.disbursementPolicy.findFirst({
      where: { organizationId, grantId: null },
    });

    return NextResponse.json({ policy });
  } catch (error) {
    console.error("GET /api/org/disbursement-policy error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST — create or update the org-wide disbursement policy
export async function POST(request: Request) {
  try {
    await assertDbHealthy();
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { organizationId, role, id: userId } = session.user;
    if (role !== "nonprofit_admin" && role !== "platform_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const {
      autoApproveEnabled,
      autoApproveMaxAmount,
      autoApproveCategories,
      autoApproveRiskLevels,
      requireReviewAbove,
      cashToRecipient,
      reimbursementToRecipient,
      rentUtilityPayments,
      recurringSubscriptions,
      maxSingleTransaction,
      allowedCategories,
      blockedCategories,
    } = body;

    // Build upsert data
    const data = {
      autoApproveEnabled: autoApproveEnabled ?? false,
      autoApproveMaxAmount: autoApproveMaxAmount != null ? parseFloat(autoApproveMaxAmount) : null,
      autoApproveCategories: autoApproveCategories ?? null,
      autoApproveRiskLevels: autoApproveRiskLevels ?? ["LIKELY_SAFE"],
      requireReviewAbove: requireReviewAbove != null ? parseFloat(requireReviewAbove) : null,
      cashToRecipient: cashToRecipient ?? "DISALLOWED",
      reimbursementToRecipient: reimbursementToRecipient ?? "DISALLOWED",
      rentUtilityPayments: rentUtilityPayments ?? "REQUIRES_REVIEW",
      recurringSubscriptions: recurringSubscriptions ?? "ALLOWED",
      maxSingleTransaction: maxSingleTransaction != null ? parseFloat(maxSingleTransaction) : null,
      allowedCategories: allowedCategories ?? null,
      blockedCategories: blockedCategories ?? null,
    };

    // Find existing org-wide policy
    const existing = await prisma.disbursementPolicy.findFirst({
      where: { organizationId, grantId: null },
    });

    let policy;
    if (existing) {
      policy = await prisma.disbursementPolicy.update({
        where: { id: existing.id },
        data,
      });
    } else {
      policy = await prisma.disbursementPolicy.create({
        data: {
          organizationId,
          grantId: null,
          ...data,
        },
      });
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId,
        organizationId,
        action: existing ? "update" : "create",
        entityType: "disbursement_policy",
        entityId: policy.id,
        oldValue: existing ? { autoApproveEnabled: existing.autoApproveEnabled } : null,
        newValue: { autoApproveEnabled: policy.autoApproveEnabled, autoApproveMaxAmount: data.autoApproveMaxAmount },
      },
    });

    return NextResponse.json({ policy });
  } catch (error) {
    if (error instanceof DbUnavailableError) {
      return errorResponse({
        kind: "dependency_unavailable",
        message: "Aurora is currently unavailable; please retry.",
        route: ROUTE_POST,
        method: "POST",
        retryAfterSeconds: Math.ceil(error.cooldown_ms_remaining / 1000),
        cause: error,
      });
    }
    console.error("POST /api/org/disbursement-policy error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

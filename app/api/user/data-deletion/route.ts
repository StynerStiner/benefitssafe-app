// POST /api/user/data-deletion — CCPA/GDPR right to deletion
// AUTH REQUIRED, BENEFICIARY ROLE ONLY

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { assertDbHealthy, DbUnavailableError } from "@/lib/db-health";
import { errorResponse } from "@/lib/error-response";
import { Prisma } from "@/lib/generated/prisma/client";
import { NextResponse } from "next/server";

const ROUTE = "api/user/data-deletion:POST";

export async function POST() {
  try {
    await assertDbHealthy();
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "beneficiary") {
      return NextResponse.json(
        {
          error:
            "Only beneficiaries can request data deletion. Contact your organization admin.",
        },
        { status: 403 }
      );
    }

    const userId = session.user.id;
    const orgId = session.user.organizationId;

    // Anonymize PII instead of hard delete (preserves audit trail integrity)
    await prisma.user.update({
      where: { id: userId },
      data: {
        firstName: "DELETED",
        lastName: "USER",
        email: `deleted_${userId}@benefitssafe.removed`,
        phone: null,
        dateOfBirth: null,
        addressStreet: null,
        addressCity: null,
        addressState: null,
        addressZip: null,
        ssnLast4: null,
        benefitPrograms: Prisma.DbNull,
        emergencyContactName: null,
        emergencyContactPhone: null,
        notes: null,
        avatarUrl: null,
        isActive: false,
        passwordHash: null,
      },
    });

    // Deactivate any active cards
    await prisma.virtualCard.updateMany({
      where: { beneficiaryId: userId, status: "ACTIVE" },
      data: { status: "CANCELLED" },
    });

    // Audit log (uses anonymized data)
    await prisma.auditLog.create({
      data: {
        userId,
        organizationId: orgId,
        action: "data_deletion_request",
        entityType: "user",
        entityId: userId,
        newValue: {
          deletedAt: new Date().toISOString(),
          method: "CCPA/GDPR right to deletion",
        },
      },
    });

    return NextResponse.json({
      message:
        "Your personal data has been anonymized and your account has been deactivated. Active virtual cards have been cancelled.",
      deletedAt: new Date().toISOString(),
    });
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
    console.error("POST /api/user/data-deletion error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

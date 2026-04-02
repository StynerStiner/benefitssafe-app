// GET /api/user/data-export — CCPA/GDPR data export (user's own data)
// AUTH REQUIRED, SELF-SCOPED

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const orgId = session.user.organizationId;

    const [profile, grants, expenses, documents, cards, auditLogs] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          dateOfBirth: true,
          addressStreet: true,
          addressCity: true,
          addressState: true,
          addressZip: true,
          benefitPrograms: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          // NEVER include passwordHash, ssnLast4, mfaSecret
        },
      }),
      prisma.grant.findMany({
        where: { beneficiaryId: userId },
        select: {
          id: true,
          name: true,
          totalAmount: true,
          spentAmount: true,
          remainingAmount: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.expenseRequest.findMany({
        where: { requestedById: userId },
        select: {
          id: true,
          description: true,
          amount: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.document.findMany({
        where: {
          OR: [
            { uploadedById: userId },
            { entityType: "beneficiary", entityId: userId },
          ],
        },
        select: {
          id: true,
          fileName: true,
          fileType: true,
          createdAt: true,
        },
      }),
      prisma.virtualCard.findMany({
        where: { beneficiaryId: userId },
        select: {
          id: true,
          last4: true,
          status: true,
          cardType: true,
          createdAt: true,
        },
      }),
      prisma.auditLog.findMany({
        where: { userId, organizationId: orgId },
        take: 100,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          action: true,
          entityType: true,
          createdAt: true,
        },
      }),
    ]);

    // Audit this export
    prisma.auditLog
      .create({
        data: {
          userId,
          organizationId: orgId,
          action: "data_export",
          entityType: "user",
          entityId: userId,
          newValue: { exportedAt: new Date().toISOString() },
        },
      })
      .catch(() => {});

    return NextResponse.json({
      exportDate: new Date().toISOString(),
      userData: profile,
      grants,
      expenses,
      documents,
      virtualCards: cards,
      recentAuditLogs: auditLogs,
    });
  } catch (error) {
    console.error("GET /api/user/data-export error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

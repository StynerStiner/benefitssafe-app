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

    const [
      profile,
      grants,
      expenses,
      documents,
      cards,
      auditLogs,
      memberships,
      invites,
      approvals,
      notifications,
      cardholderEligibility,
    ] = await Promise.all([
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
        where: { beneficiaryId: userId, organizationId: orgId },
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
        where: { requestedById: userId, organizationId: orgId },
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
          organizationId: orgId,
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
        where: { beneficiaryId: userId, organizationId: orgId },
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
      // LINDDUN-D (CCPA §1798.110 + GDPR Art. 15) — additional user-referencing
      // tables. Conservative field selection: free-text fields that may embed
      // cross-user PII (Approval.notes, Notification.message,
      // CardholderEligibility.probationParoleRestrictions) are excluded.
      prisma.organizationMembership.findMany({
        where: { userId },
        select: { id: true, organizationId: true, role: true, memberCode: true, notes: true, createdAt: true },
      }),
      prisma.inviteToken.findMany({
        where: { userId },
        select: { id: true, method: true, sentTo: true, createdAt: true, expiresAt: true, usedAt: true },
      }),
      prisma.approval.findMany({
        where: { approverId: userId, organizationId: orgId },
        select: { id: true, action: true, expenseId: true, createdAt: true },
      }),
      prisma.notification.findMany({
        where: { userId, organizationId: orgId },
        select: { id: true, type: true, title: true, entityType: true, entityId: true, read: true, createdAt: true },
      }),
      prisma.cardholderEligibility.findUnique({
        where: { beneficiaryId: userId },
        select: { id: true, eligibilityStatus: true, ofacScreened: true, ofacScreenedAt: true },
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
      organizationMemberships: memberships,
      inviteTokens: invites,
      approvals,
      notifications,
      cardholderEligibility,
    });
  } catch (error) {
    console.error("GET /api/user/data-export error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/memberships/[id] — Revoke a user's membership from this org
// Does NOT globally deactivate the user unless they have no remaining active memberships.

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, organizationId } = session.user;
    if (role !== "nonprofit_admin" && role !== "platform_admin") {
      return NextResponse.json({ error: "Only admins can revoke memberships" }, { status: 403 });
    }

    const { id: membershipId } = await params;

    // Find the membership and verify it belongs to this org
    const membership = await prisma.organizationMembership.findFirst({
      where: { id: membershipId, organizationId },
      select: { id: true, userId: true, role: true, status: true },
    });

    if (!membership) {
      return NextResponse.json({ error: "Membership not found" }, { status: 404 });
    }

    // Prevent revoking your own membership
    if (membership.userId === session.user.id) {
      return NextResponse.json({ error: "Cannot revoke your own membership" }, { status: 400 });
    }

    // Revoke the membership
    await prisma.organizationMembership.update({
      where: { id: membershipId },
      data: { status: "revoked" },
    });

    // Freeze/cancel any active virtual cards for this user in this org
    const frozenCards = await prisma.virtualCard.updateMany({
      where: {
        organizationId,
        beneficiaryId: membership.userId,
        status: "ACTIVE",
      },
      data: { status: "FROZEN" },
    });

    // Check if user has any remaining active memberships
    const remainingActive = await prisma.organizationMembership.count({
      where: {
        userId: membership.userId,
        status: "active",
        id: { not: membershipId },
      },
    });

    // If no remaining active memberships, deactivate user globally
    if (remainingActive === 0) {
      await prisma.user.update({
        where: { id: membership.userId },
        data: { isActive: false },
      });
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        organizationId,
        action: "revoke_membership",
        entityType: "organization_membership",
        entityId: membershipId,
        newValue: {
          revokedUserId: membership.userId,
          revokedRole: membership.role,
          cardsFrozen: frozenCards.count,
          globallyDeactivated: remainingActive === 0,
        },
      },
    });

    return NextResponse.json({
      message: "Membership revoked",
      cardsFrozen: frozenCards.count,
      globallyDeactivated: remainingActive === 0,
    });
  } catch (error) {
    console.error("DELETE /api/memberships/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

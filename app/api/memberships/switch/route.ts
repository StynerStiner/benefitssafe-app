// POST /api/memberships/switch -- Switch active organization
// Updates both the membership lastAccessedAt AND the legacy user.organizationId
// for backward compatibility with all existing org-scoped queries.

// @ts-nocheck
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { assertDbHealthy, DbUnavailableError } from "@/lib/db-health";
import { errorResponse } from "@/lib/error-response";
import { NextResponse } from "next/server";

const ROUTE = "api/memberships/switch:POST";

export async function POST(request: Request) {
  try {
    await assertDbHealthy();
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { organizationId } = await request.json();

    if (!organizationId) {
      return NextResponse.json(
        { error: "organizationId is required" },
        { status: 400 },
      );
    }

    // Verify user has an active membership in this org
    const membership = await prisma.organizationMembership.findFirst({
      where: {
        userId: session.user.id,
        organizationId,
        status: "active",
      },
      include: {
        organization: {
          select: { id: true, name: true },
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "No active membership in this organization" },
        { status: 403 },
      );
    }

    // Update lastAccessedAt on the membership
    await prisma.organizationMembership.update({
      where: { id: membership.id },
      data: { lastAccessedAt: new Date() },
    });

    // Update user's current organizationId AND role to match the membership
    // This keeps backward compatibility with all existing org-scoped queries
    // and ensures the JWT gets the correct role for this org
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        organizationId,
        role: membership.role || session.user.role,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        organizationId,
        action: "switch_org",
        entityType: "organization",
        entityId: organizationId,
        newValue: { orgName: membership.organization.name, role: membership.role },
      },
    });

    return NextResponse.json({
      success: true,
      activeOrg: membership.organization,
      role: membership.role,
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
    console.error("POST /api/memberships/switch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ORG-SCOPED: All queries filtered by session.user.organizationId
// No cross-organization data leakage possible.

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// GET /api/users?role=beneficiary&search=john&limit=20&offset=0
// Supports server-side search and pagination for large datasets (1M+ users)
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, organizationId } = session.user;
    const usersAllowedRoles = [
      "nonprofit_admin", "nonprofit_staff", "platform_admin",
      "auditor", "cpa", "attorney", "compliance_officer",
    ];
    if (!usersAllowedRoles.includes(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const params = request.nextUrl.searchParams;
    const roleFilter = params.get("role");
    const search = params.get("search")?.trim();
    const limit = Math.min(parseInt(params.get("limit") || "20"), 100);
    const offset = parseInt(params.get("offset") || "0");

    // ------------------------------------------------------------------
    // Multi-org list: scope by OrganizationMembership, NOT User.organizationId.
    // A team member (nonprofit_staff, cpa, auditor, attorney, etc.) may
    // belong to many nonprofits via multiple memberships. The User row's
    // organizationId only points at their currently active session org and
    // is the wrong filter for "show me MY org's team".
    // ------------------------------------------------------------------
    const membershipWhere: Record<string, unknown> = {
      organizationId,
      status: "active",
    };
    if (roleFilter) {
      membershipWhere.role = roleFilter;
    }
    if (search) {
      membershipWhere.user = {
        OR: [
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { phone: { contains: search } },
          { id: { contains: search } },
        ],
      };
    }

    const [memberships, total] = await Promise.all([
      prisma.organizationMembership.findMany({
        where: membershipWhere as never,
        select: {
          id: true,
          memberCode: true,
          status: true,
          role: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              role: true,
              isActive: true,
              avatarUrl: true,
              beneficiaryCode: true,
              addressCity: true,
              addressState: true,
              createdAt: true,
            },
          },
        },
        orderBy: { user: { lastName: "asc" } },
        take: limit,
        skip: offset,
      }),
      prisma.organizationMembership.count({ where: membershipWhere as never }),
    ]);

    // Flatten to the same shape the existing UI consumes. The per-org
    // memberCode comes from the membership row; the role we surface is
    // the membership role (per-org) not User.role (global / last-active).
    const users = memberships.map((m) => ({
      ...m.user,
      role: m.role || m.user.role,
      memberships: [{ id: m.id, memberCode: m.memberCode, status: m.status }],
    }));

    return NextResponse.json({
      users,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    });
  } catch (error) {
    console.error("GET /api/users error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

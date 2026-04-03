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
    if (role !== "nonprofit_admin" && role !== "nonprofit_staff" && role !== "platform_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const params = request.nextUrl.searchParams;
    const roleFilter = params.get("role");
    const search = params.get("search")?.trim();
    const limit = Math.min(parseInt(params.get("limit") || "20"), 100);
    const offset = parseInt(params.get("offset") || "0");

    // Build where clause with search
    const where: Record<string, unknown> = {
      organizationId,
    };

    if (roleFilter) {
      where.role = roleFilter;
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
        { id: { contains: search } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: where as never,
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
          memberships: {
            where: { organizationId },
            select: { id: true, memberCode: true, status: true },
            take: 1,
          },
        },
        orderBy: { lastName: "asc" },
        take: limit,
        skip: offset,
      }),
      prisma.user.count({ where: where as never }),
    ]);

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

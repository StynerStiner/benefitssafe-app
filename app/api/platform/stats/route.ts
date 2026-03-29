// PLATFORM ADMIN ONLY: Cross-organization aggregate stats.
// No org scoping — platform_admin sees everything.

import { auth } from "@/auth";
import { cached, CACHE_KEYS, CACHE_TTL } from "@/lib/cache";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "platform_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const data = await cached(CACHE_KEYS.platformStats(), CACHE_TTL.SHORT, async () => {
      const [totalOrgs, totalUsers, totalGrants, activeGrants, recentOrgs, recentUsers] =
        await Promise.all([
          prisma.organization.count(),
          prisma.user.count(),
          prisma.grant.count(),
          prisma.grant.count({ where: { status: "ACTIVE" } }),
          prisma.organization.findMany({
            orderBy: { createdAt: "desc" },
            take: 10,
            include: { _count: { select: { users: true } } },
          }),
          prisma.user.findMany({
            orderBy: { createdAt: "desc" },
            take: 10,
            select: {
              firstName: true,
              lastName: true,
              email: true,
              role: true,
              createdAt: true,
            },
          }),
        ]);

      return {
        totalOrgs,
        totalUsers,
        totalGrants,
        activeGrants,
        recentOrgs,
        recentUsers,
      };
    });

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Platform stats error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

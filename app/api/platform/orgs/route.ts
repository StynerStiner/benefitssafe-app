// GET /api/platform/orgs — list every tenant organization for the
// platform-admin org picker. Platform-admin only. Includes the platform org
// itself (flagged via isPlatformOrg) so the client can show a "back to
// platform view" option and keep a single source of truth for org state.
//
// Pagination note: capped at 500 rows. Client-side filters the list by name
// and orgCode. At the 1.9M-tenant scale in the PRD we will want a real
// paginated/search endpoint, but the platform-admin team is small enough
// today that a single list load is fine and avoids premature complexity.

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

const MAX_ORGS = 500;

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "platform_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || "";

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { orgCode: { contains: search, mode: "insensitive" } },
      ];
    }

    const orgs = await prisma.organization.findMany({
      where: where as never,
      select: {
        id: true,
        name: true,
        orgCode: true,
        isPlatformOrg: true,
        subscriptionStatus: true,
      },
      orderBy: [{ isPlatformOrg: "desc" }, { name: "asc" }],
      take: MAX_ORGS,
    });

    return NextResponse.json({
      orgs,
      total: orgs.length,
      truncated: orgs.length === MAX_ORGS,
    });
  } catch (error) {
    console.error("GET /api/platform/orgs error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

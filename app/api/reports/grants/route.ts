// GET /api/reports/grants — List grant reports for the org

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, organizationId } = session.user;
    if (
      role !== "nonprofit_admin" &&
      role !== "nonprofit_staff" &&
      role !== "cpa" &&
      role !== "auditor" &&
      role !== "platform_admin"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const params = request.nextUrl.searchParams;
    const grantId = params.get("grantId");
    const limit = Math.min(parseInt(params.get("limit") || "20"), 100);
    const offset = Math.max(parseInt(params.get("offset") || "0"), 0);

    const where: Record<string, unknown> = { organizationId };
    if (grantId) where.grantId = grantId;

    const [reports, total] = await Promise.all([
      prisma.grantReport.findMany({
        where: where as never,
        orderBy: { generatedAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.grantReport.count({ where: where as never }),
    ]);

    return NextResponse.json({ reports, total, limit, offset });
  } catch (error) {
    console.error("GET /api/reports/grants error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

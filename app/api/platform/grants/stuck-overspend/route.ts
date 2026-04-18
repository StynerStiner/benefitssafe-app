// GET /api/platform/grants/stuck-overspend
//
// Lists Grant rows with allowNegativeBalance=true AND remainingAmount>=0 —
// "stuck" candidates whose flag was never cleared back to false after the
// balance was restored. Backs the platform-admin stuck-grants page which
// offers a manual reset via the sibling reset-negative-balance-flag
// endpoint. See docs/runbooks/stuck-overspend-grants.md.

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { withOrgContext } from "@/lib/org-context";
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

    return withOrgContext(
      {
        kind: "exempt",
        reason: "PLATFORM_ADMIN",
        note: "stuck-overspend-list",
      },
      async () => {
        const grants = await prisma.grant.findMany({
          where: {
            allowNegativeBalance: true,
            remainingAmount: { gte: 0 },
          },
          select: {
            id: true,
            organizationId: true,
            remainingAmount: true,
            updatedAt: true,
            organization: { select: { name: true } },
          },
          orderBy: { updatedAt: "asc" },
        });

        return NextResponse.json({
          grants: grants.map((g) => ({
            id: g.id,
            organizationId: g.organizationId,
            organization: { name: g.organization.name },
            remainingAmount: Number(g.remainingAmount),
            updatedAt: g.updatedAt.toISOString(),
          })),
        });
      },
    );
  } catch (error) {
    console.error("GET /api/platform/grants/stuck-overspend error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

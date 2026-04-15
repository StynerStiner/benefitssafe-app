// GET /api/platform/orgs — list every tenant organization for the
// platform-admin org picker. Platform-admin only. Includes the platform org
// itself (flagged via isPlatformOrg) so the client can show a "back to
// platform view" option and keep a single source of truth for org state.
//
// TODO(scale): this endpoint is hard-capped at 500 rows (MAX_ORGS below)
// and the client does an in-memory substring filter on the full list.
// That's fine for the pre-launch platform-admin team (<<100 orgs in the
// DB), but it MUST be replaced with real cursor-based pagination +
// server-side search BEFORE we cross ~10K tenant orgs. Two concrete
// failure modes at that scale:
//   1. The 500-row cap silently truncates results — an admin searching
//      for a specific nonprofit may get "not found" on a real org.
//   2. Unbounded SELECT * over the Organization table competes with
//      write traffic on the writer endpoint (this route uses the writer
//      intentionally so platform admins see their own recent writes).
// Fix shape when triggered: add `?cursor=<orgCode>&search=<q>&limit=50`,
// use `WHERE (orgCode, id) > (cursorOrgCode, cursorId) ORDER BY (orgCode,
// id)` with a covering index, and push `search` down as an ILIKE against
// the already-indexed `name` column. Do NOT implement now — YAGNI until
// we actually cross the 500-org threshold.

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

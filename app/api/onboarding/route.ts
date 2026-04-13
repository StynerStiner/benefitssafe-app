// GET /api/onboarding — first-run setup checklist.
//
// Returns the org's onboarding status derived from live DB counts. Scoped to
// the active organization in the session. Admin-only: other roles get an
// empty/complete response so the widget never renders for them.

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { computeOnboardingStatus } from "@/lib/onboarding";
import { NextResponse } from "next/server";

const ADMIN_ROLES = new Set(["nonprofit_admin", "platform_admin"]);

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { organizationId, role } = session.user;

    // Non-admins never see the onboarding checklist, so pretend it's done.
    if (!ADMIN_ROLES.has(role)) {
      return NextResponse.json({
        steps: [],
        completedCount: 0,
        totalCount: 0,
        requiredCount: 0,
        requiredCompletedCount: 0,
        isComplete: true,
      });
    }

    const status = await computeOnboardingStatus(prisma, organizationId);
    return NextResponse.json(status, {
      headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=30" },
    });
  } catch (error) {
    console.error("GET /api/onboarding error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/dashboard — consolidated read-only endpoint for dashboard page loads.
// Returns role-scoped data in a single response, cached for 60 seconds.
// Individual CRUD routes (/api/expenses, /api/grants, etc.) remain unchanged.

import { auth } from "@/auth";
import { getDashboardData } from "@/lib/data";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, organizationId, id: userId } = session.user;

    const data = await getDashboardData(role, userId, organizationId, {
      limit: 100,
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/dashboard error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

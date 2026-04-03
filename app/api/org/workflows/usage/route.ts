import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { getComposioUsage } from "@/lib/composio-usage";

// GET /api/org/workflows/usage -- Platform admin view of Composio usage
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    // Only platform admins and nonprofit admins can see usage
    if (user?.role !== "platform_admin" && user?.role !== "nonprofit_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const usage = await getComposioUsage();

    return NextResponse.json(usage);
  } catch (error) {
    console.error("GET /api/org/workflows/usage error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

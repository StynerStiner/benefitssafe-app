// GET /api/memberships -- List current user's organization memberships (for org picker)

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const memberships = await prisma.organizationMembership.findMany({
      where: {
        userId: session.user.id,
        status: "active",
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
          },
        },
      },
      orderBy: { lastAccessedAt: "desc" },
    });

    return NextResponse.json(memberships);
  } catch (error) {
    console.error("GET /api/memberships error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

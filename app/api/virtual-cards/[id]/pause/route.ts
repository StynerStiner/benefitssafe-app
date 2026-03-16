// POST /api/virtual-cards/[id]/pause — Freeze a card (ORG-SCOPED)

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { role, organizationId } = session.user;
    if (role !== "nonprofit_admin" && role !== "platform_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const card = await prisma.virtualCard.findFirst({
      where: { id, organizationId },
      select: { id: true, status: true, stripeCardId: true },
    });
    if (!card) return NextResponse.json({ error: "Card not found" }, { status: 404 });

    await prisma.virtualCard.update({
      where: { id },
      data: { status: "FROZEN" },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        organizationId,
        action: "pause_card",
        entityType: "virtual_card",
        entityId: id,
        oldValue: JSON.parse(JSON.stringify({ status: card.status })),
        newValue: JSON.parse(JSON.stringify({ status: "FROZEN" })),
      },
    });

    return NextResponse.json({ message: "Card paused", status: "FROZEN" });
  } catch (error) {
    console.error("POST /api/virtual-cards/[id]/pause error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

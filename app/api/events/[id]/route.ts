// ORG-SCOPED: All queries filtered by session.user.organizationId
// PATCH /api/events/[id] — Update a calendar event
// DELETE /api/events/[id] — Delete a calendar event

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { organizationId, id: userId } = session.user;
    const { id } = await params;

    // Verify event belongs to org
    const existing = await prisma.calendarEvent.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const body = await request.json();
    const { title, description, startDate, endDate, category, color } = body;

    const event = await prisma.calendarEvent.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(startDate !== undefined && { startDate: new Date(startDate) }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(category !== undefined && { category }),
        ...(color !== undefined && { color }),
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId,
        organizationId,
        action: "update",
        entityType: "calendar_event",
        entityId: event.id,
        oldValue: { title: existing.title, startDate: existing.startDate } as never,
        newValue: { title: event.title, startDate: event.startDate } as never,
      },
    });

    return NextResponse.json({ event });
  } catch (error) {
    console.error("PATCH /api/events/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { organizationId, id: userId } = session.user;
    const { id } = await params;

    // Verify event belongs to org
    const existing = await prisma.calendarEvent.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    await prisma.calendarEvent.delete({
      where: { id },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId,
        organizationId,
        action: "delete",
        entityType: "calendar_event",
        entityId: id,
        oldValue: { title: existing.title, startDate: existing.startDate } as never,
      },
    });

    return NextResponse.json({ message: "Event deleted" });
  } catch (error) {
    console.error("DELETE /api/events/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

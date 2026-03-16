// POST /api/organization/logo — Upload organization logo
// Only nonprofit_admin and platform_admin can upload
// Stores in public/uploads/logos/ (in production, use S3)

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { writeFile } from "fs/promises";
import { NextResponse } from "next/server";
import path from "path";

const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"];

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, organizationId } = session.user;
    if (role !== "nonprofit_admin" && role !== "platform_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Only PNG, JPEG, WebP, and SVG images are supported" }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "Logo must be under 5MB" }, { status: 400 });
    }

    const ext = file.name.split(".").pop() || "png";
    const filename = `${organizationId}-${Date.now()}.${ext}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads", "logos");
    const filePath = path.join(uploadDir, filename);

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    const logoUrl = `/uploads/logos/${filename}`;

    await prisma.organization.update({
      where: { id: organizationId },
      data: { logoUrl },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        organizationId,
        action: "update",
        entityType: "organization",
        entityId: organizationId,
        newValue: JSON.parse(JSON.stringify({ logoUrl })),
      },
    });

    return NextResponse.json({ logoUrl });
  } catch (error) {
    console.error("POST /api/organization/logo error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

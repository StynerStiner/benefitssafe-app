// POST /api/organizations/[orgId]/logo — Upload organization logo
// Mirrors /api/users/avatar pattern. Only nonprofit_admin (for their own org)
// and platform_admin may upload. Stores in S3 under org-logos/ and writes
// the public URL to Organization.logoUrl.

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { assertDbHealthy, DbUnavailableError } from "@/lib/db-health";
import { errorResponse } from "@/lib/error-response";
import { uploadOrgLogoToS3 } from "@/lib/s3-upload";
import { NextResponse } from "next/server";

const ROUTE = "api/organizations/[orgId]/logo:POST";

const MAX_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/svg+xml",
];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    await assertDbHealthy();
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgId } = await params;

    // Platform admins can upload for any org; everyone else must have an
    // active nonprofit_admin membership in *this* org.
    const isPlatformAdmin = session.user.role === "platform_admin";
    if (!isPlatformAdmin) {
      const membership = await prisma.organizationMembership.findFirst({
        where: {
          userId: session.user.id,
          organizationId: orgId,
          status: "active",
          role: "nonprofit_admin",
        },
        select: { id: true },
      });
      if (!membership) {
        return NextResponse.json(
          { error: "Only organization admins can change the logo" },
          { status: 403 },
        );
      }
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Only PNG, JPEG, WebP, and SVG images are supported" },
        { status: 415 },
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "Logo must be under 2MB" }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const logoUrl = await uploadOrgLogoToS3(buffer, orgId, file.name);

    await prisma.organization.update({
      where: { id: orgId },
      data: { logoUrl },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        organizationId: orgId,
        action: "update",
        entityType: "organization",
        entityId: orgId,
        newValue: { logoUrl },
      },
    }).catch(() => {});

    return NextResponse.json({ logoUrl });
  } catch (error) {
    if (error instanceof DbUnavailableError) {
      return errorResponse({
        kind: "dependency_unavailable",
        message: "Aurora is currently unavailable; please retry.",
        route: ROUTE,
        method: "POST",
        retryAfterSeconds: Math.ceil(error.cooldown_ms_remaining / 1000),
        cause: error,
      });
    }
    console.error("POST /api/organizations/[orgId]/logo error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

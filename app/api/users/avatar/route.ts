// POST /api/users/avatar — Upload profile image for the current user
// Stores in AWS S3 (production-ready, works everywhere)

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { uploadAvatarToS3 } from "@/lib/s3-upload";
import { NextResponse } from "next/server";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"];

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Only PNG, JPEG, GIF, and WebP images are supported" }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "Image must be under 5MB" }, { status: 400 });
    }

    // Upload to S3
    const buffer = Buffer.from(await file.arrayBuffer());
    const avatarUrl = await uploadAvatarToS3(buffer, session.user.id, file.name);

    // Update user record
    await prisma.user.update({
      where: { id: session.user.id },
      data: { avatarUrl },
    });

    return NextResponse.json({ avatarUrl });
  } catch (error) {
    // TEMPORARY: expose detailed error for avatar upload debugging (revert after diagnosis)
    const err = error as Error & { name?: string; Code?: string };
    console.error("POST /api/users/avatar error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        debug: {
          name: err?.name ?? "Unknown",
          message: err?.message ?? String(error),
          awsCode: err?.Code ?? null,
          bucket: process.env.AWS_S3_BUCKET ? "set" : "MISSING",
          region: process.env.AWS_REGION ?? "MISSING",
          hasAccessKey: Boolean(process.env.AWS_ACCESS_KEY_ID),
          hasSecretKey: Boolean(process.env.AWS_SECRET_ACCESS_KEY),
        },
      },
      { status: 500 }
    );
  }
}

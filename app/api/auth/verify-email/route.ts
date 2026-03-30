import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return NextResponse.redirect(
        new URL("/auth/login?error=missing-token", request.url)
      );
    }

    // Find user with matching verification token
    const user = await prisma.user.findUnique({
      where: { emailVerifyToken: token },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        emailVerifyExpiry: true,
        organizationId: true,
      },
    });

    if (!user) {
      return NextResponse.redirect(
        new URL("/auth/login?error=invalid-token", request.url)
      );
    }

    // Check if already verified
    if (user.emailVerified) {
      return NextResponse.redirect(
        new URL("/auth/login?verified=true", request.url)
      );
    }

    // Check token expiry (24 hours)
    if (user.emailVerifyExpiry && user.emailVerifyExpiry < new Date()) {
      return NextResponse.redirect(
        new URL("/auth/login?error=token-expired", request.url)
      );
    }

    // Mark email as verified, clear token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerifyToken: null,
        emailVerifyExpiry: null,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        organizationId: user.organizationId,
        action: "verify",
        entityType: "user",
        entityId: user.id,
        newValue: JSON.parse(
          JSON.stringify({
            email: user.email,
            emailVerified: true,
          })
        ),
      },
    });

    return NextResponse.redirect(
      new URL("/auth/login?verified=true", request.url)
    );
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("GET /api/auth/verify-email error:", err.message);
    return NextResponse.redirect(
      new URL("/auth/login?error=verification-failed", request.url)
    );
  }
}

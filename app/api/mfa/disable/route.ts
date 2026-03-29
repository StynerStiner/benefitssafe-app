// POST /api/mfa/disable -- Disable MFA for the authenticated user
// Requires a valid TOTP code or backup code to confirm identity.

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { verifyMfaToken, verifyBackupCode } from "@/lib/mfa";
import { rateLimit, RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const disableSchema = z.object({
  token: z.string().min(1, "Verification code is required"),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit
    const { allowed } = rateLimit(
      `mfa-disable:${session.user.id}`,
      RATE_LIMIT_CONFIGS.auth,
    );
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again later." },
        { status: 429 },
      );
    }

    const body = await request.json();
    const parsed = disableSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { token } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        mfaEnabled: true,
        mfaSecret: true,
        mfaBackupCodes: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.mfaEnabled || !user.mfaSecret) {
      return NextResponse.json(
        { error: "MFA is not currently enabled." },
        { status: 400 },
      );
    }

    const cleanToken = token.trim();
    const isTotpCode = /^\d{6}$/.test(cleanToken);
    let verified = false;

    if (isTotpCode) {
      verified = await verifyMfaToken(user.mfaSecret, cleanToken);
    } else {
      const codeIndex = verifyBackupCode(cleanToken, user.mfaBackupCodes);
      verified = codeIndex >= 0;
    }

    if (!verified) {
      return NextResponse.json(
        { error: "Invalid verification code. MFA was not disabled." },
        { status: 400 },
      );
    }

    // Disable MFA and clear all MFA data
    await prisma.user.update({
      where: { id: user.id },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
        mfaBackupCodes: [],
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        organizationId: session.user.organizationId,
        action: "mfa_disabled",
        entityType: "user",
        entityId: user.id,
        oldValue: { mfaEnabled: true },
        newValue: { mfaEnabled: false },
        ipAddress:
          request.headers.get("x-forwarded-for") ||
          request.headers.get("x-real-ip") ||
          undefined,
      },
    });

    return NextResponse.json({
      success: true,
      message: "MFA has been disabled.",
    });
  } catch (error) {
    console.error("POST /api/mfa/disable error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

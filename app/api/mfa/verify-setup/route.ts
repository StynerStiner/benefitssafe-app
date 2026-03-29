// POST /api/mfa/verify-setup -- Verify first TOTP token and enable MFA
// Requires authenticated session. Called after /api/mfa/setup.

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { verifyMfaToken, generateBackupCodes } from "@/lib/mfa";
import { rateLimit, RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const verifySetupSchema = z.object({
  token: z.string().length(6, "Token must be 6 digits").regex(/^\d{6}$/, "Token must be 6 digits"),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit
    const { allowed } = rateLimit(
      `mfa-verify-setup:${session.user.id}`,
      RATE_LIMIT_CONFIGS.auth,
    );
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again later." },
        { status: 429 },
      );
    }

    const body = await request.json();
    const parsed = verifySetupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid token format", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { token } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, mfaSecret: true, mfaEnabled: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.mfaEnabled) {
      return NextResponse.json(
        { error: "MFA is already enabled." },
        { status: 400 },
      );
    }

    if (!user.mfaSecret) {
      return NextResponse.json(
        { error: "MFA setup not initiated. Call /api/mfa/setup first." },
        { status: 400 },
      );
    }

    // Verify the TOTP token
    const isValid = await verifyMfaToken(user.mfaSecret, token);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid verification code. Please try again." },
        { status: 400 },
      );
    }

    // Generate backup codes
    const { plainCodes, hashedCodes } = generateBackupCodes();

    // Enable MFA and store hashed backup codes
    await prisma.user.update({
      where: { id: user.id },
      data: {
        mfaEnabled: true,
        mfaBackupCodes: hashedCodes,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        organizationId: session.user.organizationId,
        action: "mfa_enabled",
        entityType: "user",
        entityId: user.id,
        newValue: { mfaEnabled: true, backupCodesGenerated: 10 },
      },
    });

    return NextResponse.json({
      success: true,
      backupCodes: plainCodes,
      message: "MFA has been enabled. Save your backup codes in a secure location.",
    });
  } catch (error) {
    console.error("POST /api/mfa/verify-setup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// POST /api/mfa/verify -- Verify TOTP token during login flow
// Called after password check when user has MFA enabled.
// Accepts either a 6-digit TOTP code or a backup recovery code.

import { prisma } from "@/lib/db";
import { verifyMfaToken, verifyBackupCode } from "@/lib/mfa";
import { rateLimit, RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const verifySchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  token: z.string().min(1, "Token is required"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = verifySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { userId, token } = parsed.data;

    // Rate limit by userId to prevent brute-force
    const { allowed } = rateLimit(
      `mfa-verify:${userId}`,
      RATE_LIMIT_CONFIGS.auth,
    );
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many verification attempts. Please try again later." },
        { status: 429 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        mfaEnabled: true,
        mfaSecret: true,
        mfaBackupCodes: true,
        organizationId: true,
      },
    });

    if (!user || !user.mfaEnabled || !user.mfaSecret) {
      return NextResponse.json(
        { error: "MFA is not configured for this account." },
        { status: 400 },
      );
    }

    const cleanToken = token.trim();

    // Check if this is a TOTP code (6 digits) or a backup code (XXXX-XXXX format)
    const isTotpCode = /^\d{6}$/.test(cleanToken);
    const isBackupCode = /^[A-Fa-f0-9]{4}-?[A-Fa-f0-9]{4}$/.test(cleanToken);

    let verified = false;

    if (isTotpCode) {
      verified = await verifyMfaToken(user.mfaSecret, cleanToken);
    } else if (isBackupCode) {
      const codeIndex = verifyBackupCode(cleanToken, user.mfaBackupCodes);
      if (codeIndex >= 0) {
        verified = true;
        // Remove used backup code
        const updatedCodes = [...user.mfaBackupCodes];
        updatedCodes.splice(codeIndex, 1);
        await prisma.user.update({
          where: { id: user.id },
          data: { mfaBackupCodes: updatedCodes },
        });

        // Audit log for backup code usage
        await prisma.auditLog.create({
          data: {
            userId: user.id,
            organizationId: user.organizationId,
            action: "mfa_backup_code_used",
            entityType: "user",
            entityId: user.id,
            newValue: { remainingBackupCodes: updatedCodes.length },
          },
        });
      }
    }

    if (!verified) {
      // Audit log for failed attempt
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          organizationId: user.organizationId,
          action: "mfa_verify_failed",
          entityType: "user",
          entityId: user.id,
          newValue: { reason: "invalid_code" },
          ipAddress:
            request.headers.get("x-forwarded-for") ||
            request.headers.get("x-real-ip") ||
            undefined,
        },
      });

      return NextResponse.json(
        { error: "Invalid verification code." },
        { status: 400 },
      );
    }

    // Audit log for successful MFA verification
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        organizationId: user.organizationId,
        action: "mfa_verify_success",
        entityType: "user",
        entityId: user.id,
        newValue: { method: isTotpCode ? "totp" : "backup_code" },
        ipAddress:
          request.headers.get("x-forwarded-for") ||
          request.headers.get("x-real-ip") ||
          undefined,
      },
    });

    return NextResponse.json({ verified: true });
  } catch (error) {
    console.error("POST /api/mfa/verify error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

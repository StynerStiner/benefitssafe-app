// POST /api/mfa/setup -- Generate TOTP secret and QR code data URL
// Requires authenticated session. Does NOT enable MFA yet.

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { assertDbHealthy, DbUnavailableError } from "@/lib/db-health";
import { errorResponse } from "@/lib/error-response";
import { generateMfaSecret } from "@/lib/mfa";
import { rateLimit, RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import QRCode from "qrcode";

const ROUTE = "api/mfa/setup:POST";

export async function POST() {
  try {
    await assertDbHealthy();
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit: use auth config (5 per minute)
    const { allowed } = rateLimit(
      `mfa-setup:${session.user.id}`,
      RATE_LIMIT_CONFIGS.auth,
    );
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, mfaEnabled: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.mfaEnabled) {
      return NextResponse.json(
        { error: "MFA is already enabled. Disable it first to reconfigure." },
        { status: 400 },
      );
    }

    // Generate TOTP secret
    const { secret, otpauthUrl } = generateMfaSecret(user.email);

    // Store the secret temporarily (not yet enabled)
    await prisma.user.update({
      where: { id: user.id },
      data: { mfaSecret: secret },
    });

    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
      width: 256,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        organizationId: session.user.organizationId,
        action: "mfa_setup_initiated",
        entityType: "user",
        entityId: user.id,
        newValue: { mfaSetupStarted: true },
      },
    });

    return NextResponse.json({
      qrCodeDataUrl,
      secret, // Allow manual entry if QR scan fails
    });
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
    console.error("POST /api/mfa/setup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

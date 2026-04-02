import { prisma } from "@/lib/db";
import { validateRecipientEmail, buildSecureLink } from "@/lib/email-security";
import { rateLimit, RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";
import crypto from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

const resendSchema = z.object({
  email: z.string().email("Invalid email"),
});

// Rate limit config: 3 per hour per email
const RESEND_RATE_LIMIT = {
  maxRequests: 3,
  windowMs: 60 * 60 * 1000, // 1 hour
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = resendSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      );
    }

    const { email } = parsed.data;

    // Validate email against disposable domains and injection attacks
    const emailCheck = validateRecipientEmail(email);
    if (!emailCheck.valid) {
      return NextResponse.json(
        { error: emailCheck.reason || "Invalid email address" },
        { status: 400 },
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Rate limit: 3 per hour per email
    const rateLimitResult = rateLimit(
      `resend-verify:${normalizedEmail}`,
      RESEND_RATE_LIMIT
    );
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error:
            "Too many verification requests. Please try again later.",
        },
        { status: 429 }
      );
    }

    // Also rate limit by IP
    const ip =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const ipRateLimitResult = rateLimit(
      `resend-verify-ip:${ip}`,
      RATE_LIMIT_CONFIGS.auth
    );
    if (!ipRateLimitResult.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        organizationId: true,
      },
    });

    // Always return success to prevent email enumeration
    if (!user || user.emailVerified) {
      return NextResponse.json({
        message:
          "If an account exists with that email and is not yet verified, a verification link has been sent.",
      });
    }

    // Generate new verification token
    const emailVerifyToken = crypto.randomUUID();
    const emailVerifyExpiry = new Date(
      Date.now() + 24 * 60 * 60 * 1000
    ); // 24 hours from now

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifyToken,
        emailVerifyExpiry,
      },
    });

    // TODO: Send verification email via Postmark/SendGrid
    // For now, log the verification URL to console for development
    const verificationUrl = buildSecureLink(`/api/auth/verify-email?token=${emailVerifyToken}`);
    console.log("-----------------------------------------------------------");
    console.log("RESEND - EMAIL VERIFICATION LINK (dev only):");
    console.log(verificationUrl);
    console.log("-----------------------------------------------------------");

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        organizationId: user.organizationId,
        action: "resend_verification",
        entityType: "user",
        entityId: user.id,
        newValue: JSON.parse(
          JSON.stringify({
            email: user.email,
            tokenExpiry: emailVerifyExpiry.toISOString(),
          })
        ),
      },
    });

    return NextResponse.json({
      message:
        "If an account exists with that email and is not yet verified, a verification link has been sent.",
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("POST /api/auth/resend-verification error:", err.message);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

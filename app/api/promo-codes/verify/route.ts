// @ts-nocheck
import { prisma } from "@/lib/db";
import { assertDbHealthy, DbUnavailableError } from "@/lib/db-health";
import { errorResponse } from "@/lib/error-response";
import { rateLimit, RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import { z } from "zod";

const ROUTE = "api/promo-codes/verify:POST";

const verifyPromoSchema = z.object({
  code: z
    .string()
    .min(1, "Code is required")
    .max(50)
    .transform((val) => val.toUpperCase().trim()),
});

/**
 * POST /api/promo-codes/verify
 * Public endpoint (no auth required) to verify a promo code during registration.
 * Rate limited to prevent abuse.
 */
export async function POST(request: Request) {
  try {
    await assertDbHealthy();
    // Rate limit by IP
    const ip =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const rateLimitResult = rateLimit(
      `promo-verify:${ip}`,
      RATE_LIMIT_CONFIGS.promoVerify,
    );
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: "Too many verification attempts. Please try again later." },
        { status: 429 },
      );
    }

    const body = await request.json();
    const parsed = verifyPromoSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { valid: false, error: "Invalid code format" },
        { status: 400 },
      );
    }

    const { code } = parsed.data;

    const promoCode = await prisma.promoCode.findUnique({
      where: { code },
      select: {
        id: true,
        code: true,
        description: true,
        trialDays: true,
        maxUses: true,
        currentUses: true,
        isActive: true,
        expiresAt: true,
      },
    });

    // Code does not exist
    if (!promoCode) {
      return NextResponse.json({
        valid: false,
        error: "Promo code not found",
      });
    }

    // Code is deactivated
    if (!promoCode.isActive) {
      return NextResponse.json({
        valid: false,
        error: "This promo code is no longer active",
      });
    }

    // Code has expired
    if (promoCode.expiresAt && new Date(promoCode.expiresAt) < new Date()) {
      return NextResponse.json({
        valid: false,
        error: "This promo code has expired",
      });
    }

    // Code has reached max uses
    if (promoCode.currentUses >= promoCode.maxUses) {
      return NextResponse.json({
        valid: false,
        error: "This promo code has reached its usage limit",
      });
    }

    // Format trial duration for display
    const days = promoCode.trialDays;
    let trialDescription: string;
    if (days >= 365) {
      const years = Math.floor(days / 365);
      trialDescription = years === 1 ? "1 year free" : `${years} years free`;
    } else if (days >= 30) {
      const months = Math.floor(days / 30);
      trialDescription =
        months === 1 ? "1 month free" : `${months} months free`;
    } else {
      trialDescription = `${days} days free`;
    }

    return NextResponse.json({
      valid: true,
      trialDays: promoCode.trialDays,
      description: promoCode.description || trialDescription,
      trialDescription,
    });
  } catch (error: unknown) {
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
    const err = error as { message?: string };
    console.error("POST /api/promo-codes/verify error:", err.message);
    return NextResponse.json(
      { valid: false, error: "Verification failed" },
      { status: 500 },
    );
  }
}

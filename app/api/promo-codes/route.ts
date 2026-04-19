// @ts-nocheck
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { assertDbHealthy, DbUnavailableError } from "@/lib/db-health";
import { errorResponse } from "@/lib/error-response";
import { NextResponse } from "next/server";
import { z } from "zod";

const ROUTE_POST = "api/promo-codes:POST";

const createPromoCodeSchema = z.object({
  code: z
    .string()
    .min(3, "Code must be at least 3 characters")
    .max(30, "Code must be at most 30 characters")
    .regex(/^[A-Z0-9]+$/, "Code must be uppercase alphanumeric only")
    .transform((val) => val.toUpperCase()),
  description: z.string().max(200).optional(),
  trialDays: z
    .number()
    .int()
    .min(1, "Trial days must be at least 1")
    .max(730, "Trial days cannot exceed 2 years"),
  maxUses: z
    .number()
    .int()
    .min(1, "Max uses must be at least 1")
    .max(10000, "Max uses cannot exceed 10,000")
    .default(50),
  expiresAt: z.string().datetime().optional().nullable(),
});

/**
 * GET /api/promo-codes
 * List all promo codes. Platform admin only.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "platform_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const promoCodes = await prisma.promoCode.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { redemptions: true },
        },
      },
    });

    return NextResponse.json({ data: promoCodes });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("GET /api/promo-codes error:", err.message);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/promo-codes
 * Create a new promo code. Platform admin only.
 */
export async function POST(request: Request) {
  try {
    await assertDbHealthy();
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "platform_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createPromoCodeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { code, description, trialDays, maxUses, expiresAt } = parsed.data;

    // Check if code already exists
    const existing = await prisma.promoCode.findUnique({
      where: { code },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A promo code with this code already exists" },
        { status: 409 },
      );
    }

    const promoCode = await prisma.promoCode.create({
      data: {
        code,
        description: description || null,
        trialDays,
        maxUses,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        createdById: session.user.id,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        organizationId: session.user.organizationId,
        action: "create",
        entityType: "promo_code",
        entityId: promoCode.id,
        newValue: JSON.parse(JSON.stringify({
          code: promoCode.code,
          trialDays: promoCode.trialDays,
          maxUses: promoCode.maxUses,
          expiresAt: promoCode.expiresAt,
        })),
      },
    });

    return NextResponse.json(
      { message: "Promo code created", data: promoCode },
      { status: 201 },
    );
  } catch (error: unknown) {
    if (error instanceof DbUnavailableError) {
      return errorResponse({
        kind: "dependency_unavailable",
        message: "Aurora is currently unavailable; please retry.",
        route: ROUTE_POST,
        method: "POST",
        retryAfterSeconds: Math.ceil(error.cooldown_ms_remaining / 1000),
        cause: error,
      });
    }
    const err = error as { message?: string };
    console.error("POST /api/promo-codes error:", err.message);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

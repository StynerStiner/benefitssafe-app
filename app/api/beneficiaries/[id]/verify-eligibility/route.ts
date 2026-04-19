// GET/POST /api/beneficiaries/[id]/verify-eligibility
// ORG-SCOPED: All queries filtered by session.user.organizationId

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { assertDbHealthy, DbUnavailableError } from "@/lib/db-health";
import { errorResponse } from "@/lib/error-response";
import { NextResponse } from "next/server";
import { z } from "zod";

const ROUTE_POST = "api/beneficiaries/[id]/verify-eligibility:POST";

const verifyEligibilitySchema = z.object({
  hasActiveWarrant: z.boolean(),
  isCurrentlyIncarcerated: z.boolean(),
  hasDrugTraffickingConviction: z.boolean(),
  probationParoleRestrictions: z.string().optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, organizationId } = session.user;
    if (role !== "nonprofit_admin" && role !== "platform_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: beneficiaryId } = await params;

    // Verify beneficiary belongs to this org before returning eligibility
    const beneficiary = await prisma.user.findFirst({
      where: { id: beneficiaryId, organizationId, role: "beneficiary" },
      select: { id: true },
    });

    if (!beneficiary) {
      return NextResponse.json(
        { error: "Beneficiary not found in your organization" },
        { status: 404 },
      );
    }

    const eligibility = await prisma.cardholderEligibility.findUnique({
      where: { beneficiaryId },
    });

    if (!eligibility) {
      return NextResponse.json({
        status: "PENDING_VERIFICATION",
        exists: false,
      });
    }

    return NextResponse.json(eligibility);
  } catch (error) {
    console.error("GET /api/beneficiaries/[id]/verify-eligibility error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await assertDbHealthy();
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, organizationId } = session.user;
    if (role !== "nonprofit_admin" && role !== "platform_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: beneficiaryId } = await params;

    const body = await request.json();
    const parsed = verifyEligibilitySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const {
      hasActiveWarrant,
      isCurrentlyIncarcerated,
      hasDrugTraffickingConviction,
      probationParoleRestrictions,
    } = parsed.data;

    // Calculate eligibility status based on flags
    let eligibilityStatus: "ELIGIBLE" | "RESTRICTED_CALFRESH_ONLY" | "INELIGIBLE_WARRANT" | "INELIGIBLE_INCARCERATED" = "ELIGIBLE";

    if (hasActiveWarrant) {
      eligibilityStatus = "INELIGIBLE_WARRANT";
    } else if (isCurrentlyIncarcerated) {
      eligibilityStatus = "INELIGIBLE_INCARCERATED";
    } else if (hasDrugTraffickingConviction) {
      eligibilityStatus = "RESTRICTED_CALFRESH_ONLY";
    }

    // Verify beneficiary exists and belongs to org
    const beneficiary = await prisma.user.findFirst({
      where: {
        id: beneficiaryId,
        organizationId,
        role: "beneficiary",
      },
      select: { id: true },
    });

    if (!beneficiary) {
      return NextResponse.json(
        { error: "Beneficiary not found in your organization" },
        { status: 404 },
      );
    }

    const eligibility = await prisma.cardholderEligibility.upsert({
      where: { beneficiaryId },
      create: {
        beneficiaryId,
        organizationId,
        hasActiveWarrant,
        isCurrentlyIncarcerated,
        hasDrugTraffickingConviction,
        probationParoleRestrictions: probationParoleRestrictions || null,
        eligibilityStatus,
        verifiedBy: session.user.email || session.user.id,
        verifiedAt: new Date(),
      },
      update: {
        hasActiveWarrant,
        isCurrentlyIncarcerated,
        hasDrugTraffickingConviction,
        probationParoleRestrictions: probationParoleRestrictions || null,
        eligibilityStatus,
        verifiedBy: session.user.email || session.user.id,
        verifiedAt: new Date(),
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        organizationId,
        action: "verify_eligibility",
        entityType: "cardholder_eligibility",
        entityId: eligibility.id,
        newValue: JSON.parse(JSON.stringify({
          beneficiaryId,
          eligibilityStatus,
          hasActiveWarrant,
          isCurrentlyIncarcerated,
          hasDrugTraffickingConviction,
          probationParoleRestrictions: probationParoleRestrictions || null,
          verifiedBy: session.user.email,
        })),
      },
    });

    return NextResponse.json(eligibility);
  } catch (error) {
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
    console.error("POST /api/beneficiaries/[id]/verify-eligibility error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

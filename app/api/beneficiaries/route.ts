// ORG-SCOPED: All queries filtered by session.user.organizationId
// No cross-organization data leakage possible.

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { captureApiError } from "@/lib/error-handler";
import { rateLimit, RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";
import { createBeneficiarySchema } from "@/lib/validations/beneficiary";
import { NextResponse } from "next/server";

// GET /api/beneficiaries — list beneficiaries scoped to organization (paginated)
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, organizationId } = session.user;
    if (role !== "nonprofit_admin" && role !== "nonprofit_staff" && role !== "platform_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);

    // Parse and validate pagination params
    const rawLimit = parseInt(searchParams.get("limit") ?? "25", 10);
    const rawOffset = parseInt(searchParams.get("offset") ?? "0", 10);
    const limit = Math.min(Math.max(Number.isNaN(rawLimit) ? 25 : rawLimit, 1), 100);
    const offset = Math.max(Number.isNaN(rawOffset) ? 0 : rawOffset, 0);

    const userWhere = {
      organizationId,
      role: "beneficiary" as const,
      isActive: true,
    };

    const [beneficiaries, total] = await Promise.all([
      prisma.user.findMany({
        where: userWhere,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          avatarUrl: true,
          addressCity: true,
          addressState: true,
          isActive: true,
          createdAt: true,
          benefitPrograms: true,
          grants: {
            where: { archivedAt: null },
            select: {
              id: true,
              name: true,
              status: true,
              remainingAmount: true,
            },
          },
        },
        orderBy: { lastName: "asc" },
        take: limit,
        skip: offset,
      }),
      prisma.user.count({ where: userWhere }),
    ]);

    // Transform to include summary stats — NEVER include ssnLast4 in list
    const result = beneficiaries.map((b) => {
      const activeGrants = b.grants.filter((g) => g.status === "ACTIVE");
      const totalRemaining = b.grants.reduce(
        (sum, g) => sum + Number(g.remainingAmount),
        0,
      );
      return {
        id: b.id,
        firstName: b.firstName,
        lastName: b.lastName,
        email: b.email,
        phone: b.phone,
        avatarUrl: b.avatarUrl,
        addressCity: b.addressCity,
        addressState: b.addressState,
        isActive: b.isActive,
        createdAt: b.createdAt,
        benefitPrograms: b.benefitPrograms,
        activeGrantCount: activeGrants.length,
        totalGrantCount: b.grants.length,
        totalRemainingBalance: totalRemaining,
      };
    });

    return NextResponse.json({ data: result, total, limit, offset });
  } catch (error) {
    captureApiError(error, { route: "GET /api/beneficiaries" });
    console.error("GET /api/beneficiaries error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// POST /api/beneficiaries — create a new beneficiary
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, organizationId } = session.user;
    if (role !== "nonprofit_admin" && role !== "nonprofit_staff" && role !== "platform_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Rate limit: 20 requests per minute per user
    const rateLimitResult = rateLimit(
      `beneficiary-create:${session.user.id}`,
      RATE_LIMIT_CONFIGS.beneficiaryCreate,
    );
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((rateLimitResult.resetAt.getTime() - Date.now()) / 1000)),
            "X-RateLimit-Remaining": String(rateLimitResult.remaining),
          },
        },
      );
    }

    const body = await request.json();
    const parsed = createBeneficiarySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const data = parsed.data;

    // Check for existing email globally (email has unique constraint)
    const existing = await prisma.user.findUnique({
      where: { email: data.email },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 409 },
      );
    }

    // Clean optional empty strings to null
    const clean = (val: string | undefined): string | null =>
      val && val.trim() ? val.trim() : null;

    const createData = {
      email: data.email,
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      phone: clean(data.phone),
      role: "beneficiary" as const,
      organizationId,
      avatarUrl: (data as any).avatarUrl || null,
      dateOfBirth: data.dateOfBirth && data.dateOfBirth.trim() ? new Date(data.dateOfBirth) : null,
      addressStreet: clean(data.addressStreet),
      addressCity: clean(data.addressCity),
      addressState: clean(data.addressState),
      addressZip: clean(data.addressZip),
      ssnLast4: clean(data.ssnLast4),
      benefitPrograms: data.benefitPrograms ? data.benefitPrograms : undefined,
      emergencyContactName: clean(data.emergencyContactName),
      emergencyContactPhone: clean(data.emergencyContactPhone),
      notes: clean(data.notes),
    };

    const beneficiary = await prisma.user.create({
      data: createData,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        createdAt: true,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        organizationId,
        action: "create",
        entityType: "user",
        entityId: beneficiary.id,
        newValue: {
          firstName: beneficiary.firstName,
          lastName: beneficiary.lastName,
          email: beneficiary.email,
          role: "beneficiary",
        },
      },
    });

    return NextResponse.json(beneficiary, { status: 201 });
  } catch (error: unknown) {
    const err = error as { code?: string; meta?: unknown; message?: string };
    captureApiError(error, { route: "POST /api/beneficiaries" });
    console.error("POST /api/beneficiaries error:", {
      message: err.message,
      code: err.code,
      meta: err.meta,
    });

    // Handle Prisma unique constraint violation
    if (err.code === "P2002") {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

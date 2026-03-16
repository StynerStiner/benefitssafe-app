// ORG-SCOPED: All queries filtered by session.user.organizationId
// No cross-organization data leakage possible.

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { createBeneficiarySchema } from "@/lib/validations/beneficiary";
import { NextResponse } from "next/server";

// GET /api/beneficiaries — list beneficiaries scoped to organization
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, organizationId } = session.user;
    if (role !== "nonprofit_admin" && role !== "nonprofit_staff" && role !== "platform_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const beneficiaries = await prisma.user.findMany({
      where: {
        organizationId,
        role: "beneficiary",
        isActive: true,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
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
    });

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

    return NextResponse.json(result);
  } catch (error) {
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

    const body = await request.json();
    const parsed = createBeneficiarySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const data = parsed.data;
    console.log("[POST /api/beneficiaries] Validated data:", { ...data, ssnLast4: data.ssnLast4 ? "****" : null });

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

    console.log("[POST /api/beneficiaries] Creating user record...");

    const createData = {
      email: data.email,
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      phone: clean(data.phone),
      role: "beneficiary" as const,
      organizationId,
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

    console.log("[POST /api/beneficiaries] Created:", beneficiary.id);

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

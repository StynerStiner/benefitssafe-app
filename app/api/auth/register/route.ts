import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

const registerApiSchema = z.object({
  organizationName: z.string().min(2, "Organization name is required"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(15, "Password must be at most 15 characters")
    .regex(/[a-zA-Z]/, "Must contain at least one letter")
    .regex(/[0-9]/, "Must contain at least one number")
    .regex(/[^a-zA-Z0-9]/, "Must contain at least one special character"),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = registerApiSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { organizationName, firstName, lastName, email, password } = parsed.data;

    // Check for existing email
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 409 },
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create Organization + Admin User in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: organizationName.trim(),
        },
        select: { id: true, name: true },
      });

      const user = await tx.user.create({
        data: {
          email: email.toLowerCase().trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          passwordHash,
          role: "nonprofit_admin",
          organizationId: organization.id,
        },
        select: { id: true, email: true, firstName: true, lastName: true },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          action: "create",
          entityType: "organization",
          entityId: organization.id,
          newValue: JSON.parse(JSON.stringify({
            organizationName: organization.name,
            adminEmail: user.email,
            adminName: `${user.firstName} ${user.lastName}`,
          })),
        },
      });

      return { organization, user };
    });

    return NextResponse.json(
      {
        message: "Organization created successfully",
        organizationId: result.organization.id,
        userId: result.user.id,
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    console.error("POST /api/auth/register error:", err.message);

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

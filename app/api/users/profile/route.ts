import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { assertDbHealthy, DbUnavailableError } from "@/lib/db-health";
import { errorResponse } from "@/lib/error-response";
import { getProfileConfig, type ProfileField } from "@/lib/profile-config";
import { NextResponse } from "next/server";

const ROUTE_PATCH = "api/users/profile:PATCH";

// GET /api/users/profile — returns the authenticated user's full profile,
// including role + all role-aware fields. Shape is a superset of the legacy
// { id, firstName, lastName, email, phone, image } contract used by existing
// components (view sidebar, avatar upload widget).
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        avatarUrl: true,
        role: true,
        title: true,
        companyName: true,
        businessAddress: true,
        firmName: true,
        licenseNumber: true,
        barNumber: true,
        organizationName: true,
        emergencyContactName: true,
        emergencyContactPhone: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Per-org identity codes. memberCode is scoped to the active org so a
    // multi-org user sees a different code per organization; orgCode is the
    // organization's own ORG- sequence.
    const membership = session.user.organizationId
      ? await prisma.organizationMembership.findUnique({
          where: {
            userId_organizationId: {
              userId: user.id,
              organizationId: session.user.organizationId,
            },
          },
          select: {
            memberCode: true,
            organization: { select: { orgCode: true } },
          },
        })
      : null;

    return NextResponse.json({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone ?? "",
      image: user.avatarUrl ?? undefined,
      role: user.role,
      title: user.title ?? "",
      companyName: user.companyName ?? "",
      businessAddress: user.businessAddress ?? "",
      firmName: user.firmName ?? "",
      licenseNumber: user.licenseNumber ?? "",
      barNumber: user.barNumber ?? "",
      organizationName: user.organizationName ?? "",
      emergencyContactName: user.emergencyContactName ?? "",
      emergencyContactPhone: user.emergencyContactPhone ?? "",
      memberCode: membership?.memberCode ?? null,
      orgCode: membership?.organization?.orgCode ?? null,
    });
  } catch (error) {
    console.error("GET /api/users/profile error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/users/profile — updates only the fields allowed by the caller's
// role (enforced via getProfileConfig). Writes an AuditLog entry for every
// successful mutation. Avatar/image updates are NOT accepted here — they go
// through POST /api/users/avatar.
const ALL_KNOWN_FIELDS: ProfileField[] = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "title",
  "companyName",
  "businessAddress",
  "firmName",
  "licenseNumber",
  "barNumber",
  "organizationName",
  "emergencyContactName",
  "emergencyContactPhone",
];

const MAX_FIELD_LENGTH: Record<ProfileField, number> = {
  firstName: 80,
  lastName: 80,
  email: 254,
  phone: 30,
  title: 120,
  companyName: 160,
  businessAddress: 300,
  firmName: 160,
  licenseNumber: 60,
  barNumber: 60,
  organizationName: 160,
  emergencyContactName: 120,
  emergencyContactPhone: 30,
};

function isEmailValid(email: string): boolean {
  // Conservative: non-empty, contains @, simple structure. Full RFC validation
  // is handled upstream via Zod in auth flows; this is a defensive check only.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function PATCH(request: Request) {
  try {
    await assertDbHealthy();
    const session = await auth();
    if (!session?.user?.id || !session.user.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: userId, role, organizationId } = session.user;
    const config = getProfileConfig(role);

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    // Whitelist: only accept keys that are both (a) in ALL_KNOWN_FIELDS and
    // (b) in this role's editableFields. Anything else is silently dropped
    // with a 400 so callers don't accidentally spoof read-only fields.
    const updates: Partial<Record<ProfileField, string>> = {};
    const rejected: string[] = [];

    for (const key of Object.keys(body)) {
      if (key === "image" || key === "avatarUrl") {
        rejected.push(key);
        continue;
      }
      if (!ALL_KNOWN_FIELDS.includes(key as ProfileField)) {
        rejected.push(key);
        continue;
      }
      if (!config.editableFields.includes(key as ProfileField)) {
        rejected.push(key);
        continue;
      }

      const value = body[key];
      if (value === null || value === undefined || value === "") {
        updates[key as ProfileField] = "";
        continue;
      }
      if (typeof value !== "string") {
        return NextResponse.json(
          { error: `Field '${key}' must be a string` },
          { status: 400 }
        );
      }
      const trimmed = value.trim();
      const max = MAX_FIELD_LENGTH[key as ProfileField];
      if (trimmed.length > max) {
        return NextResponse.json(
          { error: `Field '${key}' exceeds max length of ${max}` },
          { status: 400 }
        );
      }
      if (key === "email" && !isEmailValid(trimmed)) {
        return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
      }
      updates[key as ProfileField] = trimmed;
    }

    if (rejected.length > 0) {
      return NextResponse.json(
        {
          error: "One or more fields are not editable for your role",
          rejected,
        },
        { status: 400 }
      );
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    // Firstname/lastname are required (non-null in schema). If a role tries to
    // clear them, reject rather than writing an empty string.
    if (updates.firstName === "" || updates.lastName === "") {
      return NextResponse.json(
        { error: "First name and last name cannot be empty" },
        { status: 400 }
      );
    }

    // Email uniqueness check (only if email is being changed).
    if (updates.email && updates.email.toLowerCase() !== (session.user.email ?? "").toLowerCase()) {
      const existing = await prisma.user.findUnique({
        where: { email: updates.email.toLowerCase() },
        select: { id: true },
      });
      if (existing && existing.id !== userId) {
        return NextResponse.json({ error: "Email already in use" }, { status: 409 });
      }
      updates.email = updates.email.toLowerCase();
    }

    // Normalize empty-string optional fields to null so DB stores NULL instead
    // of literal "". firstName/lastName/email/phone allow "" → "" semantics for
    // the required ones, but optional fields should clear to null.
    const REQUIRED: ProfileField[] = ["firstName", "lastName", "email"];
    const dataToWrite: Record<string, string | null> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (REQUIRED.includes(key as ProfileField)) {
        dataToWrite[key] = value as string;
      } else {
        dataToWrite[key] = value === "" ? null : (value as string);
      }
    }

    // Fetch current values for audit diff.
    const before = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        title: true,
        companyName: true,
        businessAddress: true,
        firmName: true,
        licenseNumber: true,
        barNumber: true,
        organizationName: true,
        emergencyContactName: true,
        emergencyContactPhone: true,
      },
    });

    const updated = await prisma.user.update({
      where: { id: userId },
      data: dataToWrite,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        avatarUrl: true,
        role: true,
        title: true,
        companyName: true,
        businessAddress: true,
        firmName: true,
        licenseNumber: true,
        barNumber: true,
        organizationName: true,
        emergencyContactName: true,
        emergencyContactPhone: true,
      },
    });

    // Fire-and-forget audit log. Do not block the response on this.
    prisma.auditLog
      .create({
        data: {
          userId,
          organizationId: organizationId ?? "unknown",
          action: "profile_updated",
          entityType: "user",
          entityId: userId,
          oldValue: (before as unknown as object) ?? {},
          newValue: { changedFields: Object.keys(dataToWrite), after: dataToWrite },
        },
      })
      .catch((err) => console.error("audit log write failed:", err));

    return NextResponse.json({
      id: updated.id,
      firstName: updated.firstName,
      lastName: updated.lastName,
      email: updated.email,
      phone: updated.phone ?? "",
      image: updated.avatarUrl ?? undefined,
      role: updated.role,
      title: updated.title ?? "",
      companyName: updated.companyName ?? "",
      businessAddress: updated.businessAddress ?? "",
      firmName: updated.firmName ?? "",
      licenseNumber: updated.licenseNumber ?? "",
      barNumber: updated.barNumber ?? "",
      organizationName: updated.organizationName ?? "",
      emergencyContactName: updated.emergencyContactName ?? "",
      emergencyContactPhone: updated.emergencyContactPhone ?? "",
    });
  } catch (error) {
    if (error instanceof DbUnavailableError) {
      return errorResponse({
        kind: "dependency_unavailable",
        message: "Aurora is currently unavailable; please retry.",
        route: ROUTE_PATCH,
        method: "PATCH",
        retryAfterSeconds: Math.ceil(error.cooldown_ms_remaining / 1000),
        cause: error,
      });
    }
    console.error("PATCH /api/users/profile error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

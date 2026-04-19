import { auth } from "@/auth";
import {
  STALE_CACHE_KEY_PREFIX,
  STALE_CACHE_TTL,
  cachedWithStaleness,
} from "@/lib/cache";
import { prisma } from "@/lib/db";
import { assertDbHealthy, DbUnavailableError } from "@/lib/db-health";
import { errorResponse } from "@/lib/error-response";
import { NextResponse } from "next/server";

const ROUTE_GET = "api/org:GET";
const ROUTE_PATCH = "api/org:PATCH";

// GET /api/org — Get current user's organization details
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { organizationId: true },
    });

    if (!user?.organizationId) {
      return NextResponse.json({ error: "No organization" }, { status: 404 });
    }
    const organizationId = user.organizationId;

    const cacheKey = `${STALE_CACHE_KEY_PREFIX}:${organizationId}:org:settings:default`;
    const staleResult = await cachedWithStaleness({
      key: cacheKey,
      ttlSeconds: STALE_CACHE_TTL.ORG_SETTINGS.ttlSeconds,
      maxStaleSeconds: STALE_CACHE_TTL.ORG_SETTINGS.maxStaleSeconds,
      fetcher: () => buildOrgSettingsResponse(organizationId),
    });

    if (staleResult.kind === "unavailable") {
      return errorResponse({
        kind: "dependency_unavailable",
        message: "Aurora is currently unavailable; please retry.",
        route: ROUTE_GET,
        method: "GET",
        retryAfterSeconds: 30,
      });
    }

    if (staleResult.data === null) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    if (staleResult.kind === "stale") {
      return NextResponse.json(
        {
          ...staleResult.data,
          _meta: {
            stale: true,
            staleSeconds: staleResult.staleSeconds,
            cachedAt: staleResult.cachedAt,
          },
        },
        { headers: { "X-Data-Staleness": String(staleResult.staleSeconds) } },
      );
    }

    return NextResponse.json(staleResult.data);
  } catch (error) {
    console.error("GET /api/org error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function buildOrgSettingsResponse(organizationId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      name: true,
      ein: true,
      einVerified: true,
      address: true,
      phone: true,
      website: true,
      logoUrl: true,
      stripeAccountId: true,
      stripeFinancialAccountId: true,
      subscriptionStatus: true,
      createdAt: true,
    },
  });

  if (!org) return null;

  // Parse address into parts for the form (stored as "street, city, state zip")
  let addressStreet = "";
  let addressCity = "";
  let addressState = "";
  let addressZip = "";
  if (org.address) {
    const parts = org.address.split(",").map((p) => p.trim());
    addressStreet = parts[0] || "";
    addressCity = parts[1] || "";
    const stateZip = (parts[2] || "").split(" ").filter(Boolean);
    addressState = stateZip[0] || "";
    addressZip = stateZip[1] || "";
  }

  return {
    ...org,
    email: null as string | null, // Organization doesn't have email field — use admin's email
    addressStreet,
    addressCity,
    addressState,
    addressZip,
  };
}

// PATCH /api/org — Update organization details
export async function PATCH(request: Request) {
  try {
    await assertDbHealthy();
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { organizationId: true, role: true },
    });

    if (!user?.organizationId) {
      return NextResponse.json({ error: "No organization" }, { status: 404 });
    }

    if (user.role !== "nonprofit_admin" && user.role !== "platform_admin") {
      return NextResponse.json({ error: "Only admins can update organization" }, { status: 403 });
    }

    const body = await request.json();
    const { name, phone, website, addressStreet, addressCity, addressState, addressZip } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Organization name is required" }, { status: 400 });
    }

    // Combine address parts into single string
    const addressParts = [addressStreet, addressCity, [addressState, addressZip].filter(Boolean).join(" ")].filter(Boolean);
    const address = addressParts.length > 0 ? addressParts.join(", ") : null;

    const updated = await prisma.organization.update({
      where: { id: user.organizationId },
      data: {
        name: name.trim(),
        phone: phone?.trim() || null,
        website: website?.trim() || null,
        address,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        organizationId: user.organizationId,
        action: "update",
        entityType: "organization",
        entityId: updated.id,
        newValue: { name: updated.name, phone: updated.phone, website: updated.website, address: updated.address },
      },
    });

    return NextResponse.json({ success: true });
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
    console.error("PATCH /api/org error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

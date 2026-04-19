// GET  /api/vendor/profile — Get vendor profile for the logged-in vendor user
// PATCH /api/vendor/profile — Update vendor profile (vendor self-service)

import { auth } from "@/auth";
import {
  STALE_CACHE_KEY_PREFIX,
  STALE_CACHE_TTL,
  cachedWithStaleness,
  jitterTtl,
} from "@/lib/cache";
import { prisma } from "@/lib/db";
import { assertDbHealthy, DbUnavailableError } from "@/lib/db-health";
import { errorResponse } from "@/lib/error-response";
import { NextResponse } from "next/server";

const ROUTE_GET = "api/vendor/profile:GET";
const ROUTE_PATCH = "api/vendor/profile:PATCH";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "vendor") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const userId = session.user.id;

    const staleResult = await cachedWithStaleness({
      key: `${STALE_CACHE_KEY_PREFIX}:user:${userId}:vendor-profile:default`,
      ttlSeconds: jitterTtl(STALE_CACHE_TTL.LIST.ttlSeconds),
      maxStaleSeconds: STALE_CACHE_TTL.LIST.maxStaleSeconds,
      fetcher: () =>
        prisma.vendor.findFirst({
          where: {
            userId,
            archivedAt: null,
          },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            website: true,
            address: true,
            paymentMethod: true,
            taxIdCollected: true,
            form1099Required: true,
            status: true,
            type: true,
            createdAt: true,
            organization: { select: { name: true } },
          },
        }),
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
      return NextResponse.json({ error: "Vendor profile not found" }, { status: 404 });
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
    console.error("GET /api/vendor/profile error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await assertDbHealthy();
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "vendor") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const vendor = await prisma.vendor.findFirst({
      where: {
        userId: session.user.id,
        archivedAt: null,
      },
      select: { id: true, organizationId: true, status: true },
    });

    if (!vendor) {
      return NextResponse.json({ error: "Vendor profile not found" }, { status: 404 });
    }

    const body = await request.json();
    const allowedFields = ["name", "address", "phone", "website", "paymentMethod", "taxIdCollected", "notes"];
    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // If all required fields are filled, mark as AWAITING_PAYMENT_SETUP or keep status
    const isProfileComplete = body.name && body.address && body.taxIdCollected && body.paymentMethod;
    if (isProfileComplete && (vendor.status === "PENDING" || vendor.status === "DRAFT")) {
      updateData.status = "AWAITING_PAYMENT_SETUP";
    }

    const updated = await prisma.vendor.update({
      where: { id: vendor.id },
      data: updateData as never,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        website: true,
        address: true,
        paymentMethod: true,
        taxIdCollected: true,
        form1099Required: true,
        status: true,
        organization: { select: { name: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        organizationId: vendor.organizationId,
        action: "update",
        entityType: "vendor",
        entityId: vendor.id,
        newValue: JSON.parse(JSON.stringify(updateData)),
      },
    });

    return NextResponse.json(updated);
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
    console.error("PATCH /api/vendor/profile error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/org/fund/[transferId]/status — Poll the current state of a FundTransfer
// ORG-SCOPED: where clause always includes organizationId.
// RATE-LIMITED: 1 req per 2 seconds per (user, transferId).
// AUDIT-LOGGED: security events only (403 authz failure, sustained 429).

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { redis } from "@/lib/cache";
import { rateLimitAsync, RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ transferId: string }> },
) {
  const { transferId } = await params;
  let userId = "unknown";
  let organizationId = "unknown";

  try {
    // --- 1. Authn ---
    const session = await auth();
    if (!session?.user?.id) {
      console.log(`[fund-status] user=anonymous transferId=${transferId} status=401`);
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }
    userId = session.user.id;

    // --- 2. User lookup ---
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true, role: true },
    });

    if (!user || !user.organizationId) {
      console.log(`[fund-status] user=${userId} transferId=${transferId} status=400`);
      return NextResponse.json(
        { error: "User not associated with organization" },
        { status: 400 },
      );
    }
    organizationId = user.organizationId;

    // --- 3. Rate limit (before authz so wrong-role attackers cannot
    //     write unlimited authz_failure audit rows) ---
    const rateLimitKey = `fund-status:${userId}:${transferId}`;
    const rateLimitResult = await rateLimitAsync(rateLimitKey, RATE_LIMIT_CONFIGS.fundStatusPoll);

    if (!rateLimitResult.allowed) {
      console.warn(`[fund-status] user=${userId} transferId=${transferId} status=429`);

      // Write AuditLog at most once per 60-second episode to avoid
      // polluting the audit table on sustained abuse. A Redis SETEX
      // key with 60s TTL tracks the cooldown; if the key already
      // exists, skip the audit write. Fails open: if Redis is down
      // the audit write fires (better to over-log than under-log
      // security events).
      const auditCooldownKey = `audit-cooldown:fund-status:${userId}`;
      let shouldAudit = true;
      if (redis) {
        try {
          const res = await redis.set(auditCooldownKey, "1", { nx: true, ex: 60 });
          shouldAudit = res === "OK";
        } catch {
          // Redis down — fail open, allow the audit write.
        }
      }
      if (shouldAudit) {
        await prisma.auditLog.create({
          data: {
            userId,
            organizationId,
            action: "rate_limit_violation",
            entityType: "fund_transfer",
            entityId: transferId,
            newValue: { endpoint: "fund-status", remaining: rateLimitResult.remaining },
          },
        }).catch((err) => console.error("[fund-status] audit log write failed:", err));
      }

      return NextResponse.json(
        { error: "Too many requests. Please slow down.", retryAfter: 2 },
        { status: 429, headers: { "Retry-After": "2" } },
      );
    }

    // --- 4. Authz ---
    if (user.role !== "nonprofit_admin" && user.role !== "platform_admin") {
      console.log(`[fund-status] user=${userId} transferId=${transferId} status=403 role=${user.role}`);
      // Security-relevant: wrong role attempting to access financial data.
      await prisma.auditLog.create({
        data: {
          userId,
          organizationId,
          action: "authz_failure",
          entityType: "fund_transfer",
          entityId: transferId,
          newValue: { reason: "role_check_failed", role: user.role },
        },
      }).catch((err) => console.error("[fund-status] audit log write failed:", err));
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 },
      );
    }

    // --- 5. Tenant-isolated lookup ---
    const transfer = await prisma.fundTransfer.findFirst({
      where: { id: transferId, organizationId },
      select: {
        id: true,
        status: true,
        amountCents: true,
        currency: true,
        createdAt: true,
        updatedAt: true,
        stripeTransferId: true,
        failureReason: true,
      },
    });

    if (!transfer) {
      // 404 for both "doesn't exist" and "exists in another org" —
      // do NOT differentiate. No AuditLog on this path.
      console.log(`[fund-status] user=${userId} transferId=${transferId} status=404`);
      return NextResponse.json(
        { error: "Fund transfer not found" },
        { status: 404 },
      );
    }

    // --- Success (NO AuditLog on 200 reads) ---
    console.log(`[fund-status] user=${userId} transferId=${transferId} status=200 transferStatus=${transfer.status}`);
    return NextResponse.json({
      id: transfer.id,
      status: transfer.status,
      amountCents: transfer.amountCents,
      currency: transfer.currency,
      createdAt: transfer.createdAt.toISOString(),
      updatedAt: transfer.updatedAt.toISOString(),
      stripeTransferId: transfer.stripeTransferId,
      failureReason: transfer.failureReason,
    });
  } catch (error) {
    console.error(`[fund-status] user=${userId} transferId=${transferId} status=500`, error);

    // Best-effort AuditLog for internal errors when we have user context.
    if (userId !== "unknown" && organizationId !== "unknown") {
      // Intentional swallow: the response is already a 500. If the audit
      // write fails, log to console only. Never let the audit write itself
      // throw out of the catch block.
      await prisma.auditLog.create({
        data: {
          userId,
          organizationId,
          action: "internal_error",
          entityType: "fund_transfer",
          entityId: transferId,
          newValue: {
            endpoint: "fund-status",
            errorClass: error instanceof Error ? error.constructor.name : "unknown",
          },
        },
      }).catch((catchErr) => console.error("[fund-status] internal_error audit write failed:", catchErr));
    }

    return NextResponse.json(
      { error: "Failed to fetch transfer status" },
      { status: 500 },
    );
  }
}

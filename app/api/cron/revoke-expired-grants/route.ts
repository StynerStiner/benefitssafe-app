// BSRS Ch 5 P3 — hourly sweep that revokes expired role grants.
//
// Enforcement is NOT dependent on this cron. The α gate in auth.ts and
// the β gate in lib/auth-guard.ts#requirePlatformAdmin both check
// expiresAt at request time, so even if this cron is delayed by hours
// an expired grant CAN NOT be used. The cron only ensures that expired
// memberships have a `revokedAt` timestamp + AuditLog entry for the
// historical record.
//
// Schedule: hourly (see vercel.json). Expected volume is low — a few
// dozen grants per day org-wide — so no cursor/checkpoint pattern.

import { validateCronSecret } from "@/lib/cron-auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";

const CRON_NAME = "revoke-expired-grants";
// AuditLog.userId is a plain String (no FK), so we use a stable sentinel
// to distinguish cron auto-revocation from a human DELETE.
const SYSTEM_USER_ID = "system:cron:revoke-expired-grants";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!validateCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const now = new Date();

  // Find rather than updateMany — per-grant AuditLog writes need the
  // organizationId and id of each revoked row. Expected count is small
  // enough (low hundreds at peak) that the find+loop pattern is fine.
  const expired = await prisma.organizationMembership.findMany({
    where: {
      expiresAt: { lt: now, not: null },
      revokedAt: null,
      status: "active",
    },
    select: { id: true, userId: true, organizationId: true, expiresAt: true },
  });

  let revoked = 0;
  for (const grant of expired) {
    try {
      await prisma.$transaction([
        prisma.organizationMembership.update({
          where: { id: grant.id },
          data: { revokedAt: now, revokedBy: null, status: "revoked" },
        }),
        prisma.auditLog.create({
          data: {
            userId: SYSTEM_USER_ID,
            organizationId: grant.organizationId,
            action: "auto_revoke_expiring_role",
            entityType: "organization_membership",
            entityId: grant.id,
            newValue: {
              revokedAt: now.toISOString(),
              revokedBy: null, // null = auto-revoked by cron
              expiredAt:
                grant.expiresAt === null ? null : grant.expiresAt.toISOString(),
              userId: grant.userId,
            },
          },
        }),
      ]);
      revoked++;
    } catch (error) {
      logger.error("revoke-expired-grants: failed to revoke", {
        cron: CRON_NAME,
        grantId: grant.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const duration_ms = Date.now() - startedAt;
  logger.info("revoke-expired-grants: sweep complete", {
    cron: CRON_NAME,
    revoked,
    scanned: expired.length,
    duration_ms,
  });

  return NextResponse.json({ revoked, scanned: expired.length, duration_ms });
}

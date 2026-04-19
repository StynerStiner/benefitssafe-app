// POST /api/admin/data-deletion — admin-initiated CCPA/GDPR deletion
//
// Closes the DDIA Ch11 Stream Processing audit MODERATE finding:
//   AuditLog.oldValue / AuditLog.newValue are `Json?` columns that
//   several existing writers embed beneficiary-identifiable content
//   into — /api/grants/[id]/issue-card writes `{ beneficiary: "First
//   Last", ... }`, /api/memberships/invite writes `{ email, role }`,
//   /api/auth/reset-password writes `{ email }`. The self-service
//   /api/user/data-deletion route only anonymizes the User row, leaving
//   PII sitting in the audit trail JSON blobs forever. CCPA requires
//   deletion of ALL stored PII, not just the canonical user record.
//
// This route is the admin-side complement: it scrubs the User row AND
// walks the top-level keys of every AuditLog row tied to the user and
// replaces any known PII key with the literal string "[REDACTED]". The
// AuditLog row itself is not deleted (we keep the action, timestamp,
// actor, and non-PII fields so compliance reviewers can see that
// something happened) — only PII VALUES are redacted.
//
// Authorization:
//   - platform_admin: can scrub any user
//   - nonprofit_admin: can scrub users in their own organization only
//
// All mutations run in a single $transaction so a partial failure
// leaves the User row untouched. CCPA requires all-or-nothing on
// deletion requests — we don't want to half-scrub a user and then
// report success.

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { assertDbHealthy, DbUnavailableError } from "@/lib/db-health";
import { errorResponse } from "@/lib/error-response";
import { Prisma } from "@/lib/generated/prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

const ROUTE = "api/admin/data-deletion:POST";

// Top-level JSON keys we scrub from AuditLog.oldValue / AuditLog.newValue.
// Everything here is user-visible PII that existing writers have been
// observed to embed. Add to this list if a new writer starts logging a
// different PII-bearing key — a grep for `newValue:` across app/api is
// the source of truth.
const PII_KEYS = [
  "firstName",
  "lastName",
  "fullName",
  "email",
  "dateOfBirth",
  "ssnLast4",
  "phone",
  "phoneNumber",
  "streetAddress",
  "addressStreet",
  "addressCity",
  "addressState",
  "addressZip",
  "address",
  "beneficiary", // issue-card audit writes `${firstName} ${lastName}` here
  "beneficiaryName",
  "emergencyContactName",
  "emergencyContactPhone",
] as const;

const BodySchema = z.object({
  userId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    await assertDbHealthy();
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (
      session.user.role !== "platform_admin" &&
      session.user.role !== "nonprofit_admin"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload: userId required" },
        { status: 400 },
      );
    }
    const targetUserId = parsed.data.userId;

    // nonprofit_admin can only scrub users in their own org.
    if (session.user.role === "nonprofit_admin") {
      const target = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: { organizationId: true },
      });
      if (!target) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      if (target.organizationId !== session.user.organizationId) {
        return NextResponse.json(
          { error: "Cannot delete users outside your organization" },
          { status: 403 },
        );
      }
    }

    // PII_KEYS is a frozen const tuple — serialize once so the raw SQL
    // binding sees a plain string[] (Prisma template literal parameters
    // don't unwrap readonly arrays reliably).
    const piiKeys: string[] = [...PII_KEYS];

    const result = await prisma.$transaction(async (tx) => {
      // 1. Anonymize the User row. Mirrors the self-service route's
      //    field set so the two paths leave the DB in the same state.
      await tx.user.update({
        where: { id: targetUserId },
        data: {
          firstName: "DELETED",
          lastName: "USER",
          email: `deleted_${targetUserId}@benefitssafe.removed`,
          phone: null,
          dateOfBirth: null,
          addressStreet: null,
          addressCity: null,
          addressState: null,
          addressZip: null,
          ssnLast4: null,
          benefitPrograms: Prisma.DbNull,
          emergencyContactName: null,
          emergencyContactPhone: null,
          notes: null,
          avatarUrl: null,
          isActive: false,
          passwordHash: null,
        },
      });
      const userFields = 1;

      // 2. Scrub PII from AuditLog.oldValue and AuditLog.newValue JSON.
      //
      //    Strategy: for each row whose JSON column is a non-null object,
      //    walk the top-level keys via `jsonb_each`, keep the value as-is
      //    when the key is not PII, and replace the value with the string
      //    "[REDACTED]" when it is. Reconstruct via `jsonb_object_agg`.
      //    Non-object JSON values (arrays, scalars, nulls) are left
      //    untouched — our writers never put PII into those positions,
      //    and walking them would require a recursive function that is
      //    out of scope for this fix. Nested sub-objects (e.g. a PII
      //    string inside `{ details: { firstName: ... } }`) are not
      //    walked either; the existing writers all embed PII at the top
      //    level, and a grep for `newValue:` across app/api is the
      //    source of truth for this assumption.
      //
      //    Two separate UPDATEs so each can short-circuit on its own
      //    `IS NOT NULL` + `jsonb_typeof = 'object'` filter without
      //    touching rows that have nothing to scrub.
      const scrubOld = await tx.$executeRaw`
        UPDATE "AuditLog" a SET "oldValue" = (
          SELECT jsonb_object_agg(
            k,
            CASE WHEN k = ANY(${piiKeys}::text[])
                 THEN to_jsonb('[REDACTED]'::text)
                 ELSE v
            END
          )
          FROM jsonb_each(a."oldValue") AS t(k, v)
        )
        WHERE a."oldValue" IS NOT NULL
          AND jsonb_typeof(a."oldValue") = 'object'
          AND (a."userId" = ${targetUserId}
               OR (a."entityType" = 'user' AND a."entityId" = ${targetUserId}))
      `;

      const scrubNew = await tx.$executeRaw`
        UPDATE "AuditLog" a SET "newValue" = (
          SELECT jsonb_object_agg(
            k,
            CASE WHEN k = ANY(${piiKeys}::text[])
                 THEN to_jsonb('[REDACTED]'::text)
                 ELSE v
            END
          )
          FROM jsonb_each(a."newValue") AS t(k, v)
        )
        WHERE a."newValue" IS NOT NULL
          AND jsonb_typeof(a."newValue") = 'object'
          AND (a."userId" = ${targetUserId}
               OR (a."entityType" = 'user' AND a."entityId" = ${targetUserId}))
      `;
      const auditLogRows = Number(scrubOld) + Number(scrubNew);

      // 3. Soft-delete documents uploaded by this user. We keep the rows
      //    (so the audit trail still shows they existed) but set
      //    archivedAt so active queries filter them out. The S3 blob
      //    cleanup is handled by a separate lifecycle policy.
      const docs = await tx.document.updateMany({
        where: { uploadedById: targetUserId, archivedAt: null },
        data: { archivedAt: new Date() },
      });
      const documents = docs.count;

      // 4. Deactivate any active virtual cards. Mirrors the self-service
      //    route. A cancelled card rejects new authorizations at Stripe
      //    even before the cron syncs the status downstream.
      await tx.virtualCard.updateMany({
        where: { beneficiaryId: targetUserId, status: "ACTIVE" },
        data: { status: "CANCELLED" },
      });

      // 5. Record the deletion request itself. This audit row is NOT
      //    scrubbed — the action + actor + timestamp must survive for
      //    compliance review. We intentionally write only the event
      //    fact (no names, no email), so there's no PII to scrub.
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          organizationId: session.user.organizationId,
          action: "admin_data_deletion",
          entityType: "user",
          entityId: targetUserId,
          newValue: {
            deletedAt: new Date().toISOString(),
            method: "CCPA/GDPR admin deletion",
            scrubbedUserFields: userFields,
            scrubbedAuditLogRows: auditLogRows,
            archivedDocuments: documents,
          },
        },
      });

      return { userFields, auditLogRows, documents };
    });

    return NextResponse.json({
      success: true,
      scrubbed: result,
    });
  } catch (error) {
    if (error instanceof DbUnavailableError) {
      return errorResponse({
        kind: "dependency_unavailable",
        message: "Aurora is currently unavailable; please retry.",
        route: ROUTE,
        method: "POST",
        retryAfterSeconds: Math.ceil(error.cooldown_ms_remaining / 1000),
        cause: error,
      });
    }
    console.error("POST /api/admin/data-deletion error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

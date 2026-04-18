import { z } from "zod";

// BSRS Ch 5 §5.5 — Temporary Access. Every expiring grant has:
//   - default 30-day window (enforced at the UI; schema min is 1 day)
//   - hard 180-day ceiling, applied from NOW on both create AND extend
//     so extensions can never daisy-chain past 180 days total
//   - compliance justification ≥10 trimmed chars, ≤500 chars
//
// Note on ID format: the app uses cuid() not UUID, so userId/organizationId
// are validated as non-empty strings. The DB foreign-key constraints are
// the authoritative existence check.

export const EXPIRING_GRANT_MIN_DAYS = 1;
export const EXPIRING_GRANT_MAX_DAYS = 180;
export const EXPIRING_GRANT_DEFAULT_DAYS = 30;
export const EXPIRING_GRANT_REASON_MIN = 10;
export const EXPIRING_GRANT_REASON_MAX = 500;

// Keep in sync with enum UserRole in prisma/schema.prisma. A narrower
// subset could be used (only roles that make sense as expiring grants —
// cpa, auditor, attorney, compliance_officer), but the route layer is
// the right place for that policy; the schema just validates shape.
export const expiringGrantRoleSchema = z.enum([
  "nonprofit_admin",
  "nonprofit_staff",
  "beneficiary",
  "vendor",
  "cpa",
  "auditor",
  "attorney",
  "grant_officer",
  "platform_admin",
  "support_agent",
  "compliance_officer",
  "billing_admin",
]);

const trimmedReason = z
  .string()
  .transform((s) => s.trim())
  .pipe(
    z
      .string()
      .min(
        EXPIRING_GRANT_REASON_MIN,
        `Reason must be at least ${EXPIRING_GRANT_REASON_MIN} characters`,
      )
      .max(
        EXPIRING_GRANT_REASON_MAX,
        `Reason must be at most ${EXPIRING_GRANT_REASON_MAX} characters`,
      ),
  );

// Accepts ISO 8601 datetime strings and returns a Date instance.
// Parsing errors surface as zod validation errors rather than 500s.
const isoDatetime = z
  .string()
  .transform((s, ctx) => {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid ISO 8601 datetime",
      });
      return z.NEVER;
    }
    return d;
  });

function expiresAtInRange() {
  return isoDatetime.superRefine((value, ctx) => {
    const now = Date.now();
    const minMs = now + EXPIRING_GRANT_MIN_DAYS * 24 * 60 * 60 * 1000;
    const maxMs = now + EXPIRING_GRANT_MAX_DAYS * 24 * 60 * 60 * 1000;
    const t = value.getTime();
    if (t < minMs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `expiresAt must be at least ${EXPIRING_GRANT_MIN_DAYS} day in the future`,
      });
    }
    if (t > maxMs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `expiresAt cannot exceed ${EXPIRING_GRANT_MAX_DAYS} days from now`,
      });
    }
  });
}

export const createExpiringGrantSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  organizationId: z.string().min(1, "organizationId is required"),
  role: expiringGrantRoleSchema,
  expiresAt: expiresAtInRange(),
  grantReason: trimmedReason,
});

export type CreateExpiringGrantInput = z.infer<typeof createExpiringGrantSchema>;

// Extensions are bounded by NOW + 180 days, not by (current expiresAt +
// 180 days). This prevents an admin from serially extending a grant
// forever — every extension is a fresh 180-day cap from the moment of
// extension.
export const extendExpiringGrantSchema = z.object({
  expiresAt: expiresAtInRange(),
  extensionReason: trimmedReason,
});

export type ExtendExpiringGrantInput = z.infer<typeof extendExpiringGrantSchema>;

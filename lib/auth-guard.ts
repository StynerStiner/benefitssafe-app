// BSRS Ch 5 P4.2 — shared role-guard helper.
//
// Centralizes the session + role check pattern copy-pasted across ~95 API
// routes. Every session-authenticated route opens with a variant of:
//
//   const session = await auth();
//   if (!session?.user) return errorResponse({ kind: "unauthorized", ... });
//   const { role, id: userId, organizationId } = session.user;
//   if (role !== "nonprofit_admin" && role !== "platform_admin") {
//     return errorResponse({ kind: "forbidden", ... });
//   }
//
// That block is a moving target: changes to session shape, additional auth
// steps (MFA, rate limiting, etc.), or a migration from role-on-User to
// role-on-OrganizationMembership would otherwise have to touch every site.
// This module centralizes the pattern so those changes are one-diff edits.
//
// Composes with lib/error-response.ts (P4.1) — GuardDenial.toErrorResponse()
// produces the exact same NextResponse shape + structured log payload that
// errorResponse() does, so correlationIds flow through denials automatically.

import { auth } from "@/auth";
import type { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ApiErrorKind, errorResponse } from "./error-response";

type RawSession = Awaited<ReturnType<typeof auth>>;

/**
 * The authenticated context returned by every successful guard call. Down-
 * stream code destructures from this exactly like it destructured from
 * `session.user` before: `const { userId, organizationId, role } = ctx;`.
 */
export interface GuardContext {
  session: NonNullable<RawSession>;
  user: NonNullable<RawSession>["user"];
  userId: string;
  organizationId: string;
  role: string;
}

export interface GuardDenialInit {
  kind: ApiErrorKind;
  message: string;
  route: string;
  method?: string;
  userId: string | null;
  organizationId: string | null;
}

/**
 * Thrown by requireAuth / requireRole / requireAdmin / requirePlatformAdmin /
 * requireNonprofitStaff / requireNonVendor when authorization fails.
 *
 * Intended catch pattern — ONLY in the route's own top-level try/catch:
 *
 *   try {
 *     const { userId, organizationId } = await requireAdmin(ROUTE, "POST");
 *     // business logic
 *   } catch (error) {
 *     if (error instanceof GuardDenial) return error.toErrorResponse();
 *     return errorResponse({ kind: "internal", message: "Internal server error",
 *                            route: ROUTE, method: "POST", cause: error });
 *   }
 *
 * Order matters — the GuardDenial branch MUST come BEFORE the generic
 * internal fallback. If the order is reversed, guards are miscategorized
 * as internal errors (false-positive Sentry pages, wrong `kind` in the
 * Better Stack payload, noisy on-call).
 *
 * Do NOT:
 *   - Catch GuardDenial in middleware
 *   - Catch GuardDenial in a global error boundary
 *   - Rethrow GuardDenial after catching
 *   - Use GuardDenial for business-logic errors (use errorResponse directly
 *     for those — money-flow rejections, stale-state conflicts, etc.)
 */
export class GuardDenial extends Error {
  readonly kind: ApiErrorKind;
  readonly denialMessage: string;
  readonly route: string;
  readonly method?: string;
  readonly userId: string | null;
  readonly organizationId: string | null;

  constructor(init: GuardDenialInit) {
    super(init.message);
    this.name = "GuardDenial";
    this.kind = init.kind;
    this.denialMessage = init.message;
    this.route = init.route;
    this.method = init.method;
    this.userId = init.userId;
    this.organizationId = init.organizationId;
  }

  /**
   * Convert this denial to a NextResponse via errorResponse(). Produces the
   * same `{ error, correlationId, ... }` body shape and emits the same
   * structured `[api_error]` log line as any other errorResponse() call.
   */
  toErrorResponse(): NextResponse {
    return errorResponse({
      kind: this.kind,
      message: this.denialMessage,
      route: this.route,
      method: this.method,
      userId: this.userId,
      organizationId: this.organizationId,
    });
  }
}

const ADMIN_ROLES = ["nonprofit_admin", "platform_admin"] as const;
const PLATFORM_ADMIN_ROLES = ["platform_admin"] as const;
const NONPROFIT_STAFF_ROLES = [
  "nonprofit_admin",
  "nonprofit_staff",
  "platform_admin",
] as const;
const VENDOR_ROLE = "vendor";

// ────────────────────────────────────────────────────────────────────────
// Primitives
// ────────────────────────────────────────────────────────────────────────

/**
 * Require an authenticated session. Throws GuardDenial(kind="unauthorized",
 * 401) if there is no session or no user on the session.
 *
 * Use this for endpoints that any authenticated user can access (reads that
 * are already org-scoped at the query layer, for example). For role-gated
 * endpoints, prefer the `require*` convenience helpers below.
 */
export async function requireAuth(
  route: string,
  method?: string,
): Promise<GuardContext> {
  const session = await auth();
  if (!session?.user) {
    throw new GuardDenial({
      kind: "unauthorized",
      message: "Unauthorized",
      route,
      method,
      userId: null,
      organizationId: null,
    });
  }
  const user = session.user as NonNullable<RawSession>["user"] & {
    id: string;
    role: string;
    organizationId: string;
  };
  return {
    session: session as NonNullable<RawSession>,
    user,
    userId: user.id,
    organizationId: user.organizationId,
    role: user.role,
  };
}

/**
 * Assert that the already-authenticated context has a role in allowedRoles.
 * Throws GuardDenial(kind="forbidden", 403) otherwise. Pure function — does
 * not call auth(). Use this to compose custom role checks on top of
 * requireAuth (example: audit-logs with its 8-role ALLOWED_ROLES list).
 */
export function requireRole(
  ctx: GuardContext,
  allowedRoles: readonly string[],
  route: string,
  method?: string,
): GuardContext {
  if (!allowedRoles.includes(ctx.role)) {
    throw new GuardDenial({
      kind: "forbidden",
      message: "Forbidden",
      route,
      method,
      userId: ctx.userId,
      organizationId: ctx.organizationId,
    });
  }
  return ctx;
}

// ────────────────────────────────────────────────────────────────────────
// Convenience helpers — the four role-shapes the app actually uses.
// Each runs requireAuth first, then the role check. Throws GuardDenial on
// either failure; returns GuardContext on success.
// ────────────────────────────────────────────────────────────────────────

/** nonprofit_admin OR platform_admin. Most write endpoints. */
export async function requireAdmin(
  route: string,
  method?: string,
): Promise<GuardContext> {
  const ctx = await requireAuth(route, method);
  return requireRole(ctx, ADMIN_ROLES, route, method);
}

/**
 * platform_admin only. Cross-org and breakglass endpoints.
 *
 * BSRS Ch 5 P3 gate (β): in addition to the session role check, re-check
 * the caller's OrganizationMembership at request time. If the grant is
 * expired or revoked since the JWT was last refreshed, reject with
 * `forbidden`. Only platformAdmin gets this β check — non-platform roles
 * ride on the α gate in auth.ts alone (≤15-min JWT staleness window is
 * acceptable for non-breakglass roles; it is not acceptable for the role
 * that can read every tenant's data).
 *
 * Cost: one `OrganizationMembership.findFirst` per platform_admin request
 * on a composite (userId, organizationId) unique index — a single indexed
 * lookup, no table scan.
 */
export async function requirePlatformAdmin(
  route: string,
  method?: string,
): Promise<GuardContext> {
  const ctx = await requireAuth(route, method);
  requireRole(ctx, PLATFORM_ADMIN_ROLES, route, method);

  const membership = await prisma.organizationMembership.findFirst({
    where: {
      userId: ctx.userId,
      organizationId: ctx.organizationId,
    },
    select: { expiresAt: true, revokedAt: true },
  });

  // A platform_admin with no membership row at all is fine — that's a
  // historical seeded admin whose role lives on User.role. We only gate
  // when a membership exists AND it has been expired or revoked, which
  // is the only way a P3 time-boxed grant can be the role source.
  if (membership) {
    const now = new Date();
    const expired =
      membership.expiresAt !== null && membership.expiresAt <= now;
    const revoked = membership.revokedAt !== null;
    if (expired || revoked) {
      throw new GuardDenial({
        kind: "forbidden",
        message: "Grant expired or revoked",
        route,
        method,
        userId: ctx.userId,
        organizationId: ctx.organizationId,
      });
    }
  }

  return ctx;
}

/**
 * nonprofit_admin OR nonprofit_staff OR platform_admin. Org-internal reads
 * and writes that staff members are allowed to perform (beneficiary
 * management, etc.).
 */
export async function requireNonprofitStaff(
  route: string,
  method?: string,
): Promise<GuardContext> {
  const ctx = await requireAuth(route, method);
  return requireRole(ctx, NONPROFIT_STAFF_ROLES, route, method);
}

/**
 * Any authenticated role EXCEPT vendor. Use for reads where external vendors
 * have no business viewing the underlying data (grant details, card details,
 * compliance rules) but every other role does.
 */
export async function requireNonVendor(
  route: string,
  method?: string,
): Promise<GuardContext> {
  const ctx = await requireAuth(route, method);
  if (ctx.role === VENDOR_ROLE) {
    throw new GuardDenial({
      kind: "forbidden",
      message: "Forbidden",
      route,
      method,
      userId: ctx.userId,
      organizationId: ctx.organizationId,
    });
  }
  return ctx;
}

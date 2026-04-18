// BSRS Ch 5 P4.1 — correlation IDs on API error responses.
//
// Every API error gets a short, random, human-readable correlationId
// embedded in both the HTTP response body and a structured stdout log
// line. When a user reports "I got a 403" or "something broke", they
// share the correlationId (surfaced in the UI by a future PDR) and
// the operator greps Better Stack for that exact ID to recover full
// request context — route, user, org, error kind, underlying cause.
//
// BSRS §5.3 "Diagnosing Access Denials": the response body must not
// leak policy details. The correlationId is a debug handle, not an
// information disclosure.

import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { captureApiError } from "./error-handler";

export type ApiErrorKind =
  | "unauthorized"   // 401 — no valid session
  | "forbidden"      // 403 — session exists but role/org forbids action
  | "not_found"      // 404
  | "validation"     // 400 — zod or handcrafted input rejection
  | "conflict"       // 409 — version / unique / state collisions
  | "internal";      // 500 — unexpected server-side failure

const DEFAULT_STATUS: Record<ApiErrorKind, number> = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  validation: 400,
  conflict: 409,
  internal: 500,
};

export interface ErrorResponseOpts {
  kind: ApiErrorKind;
  /** User-facing message; lands verbatim in the response body AND the log line. */
  message: string;
  /** Route identifier, e.g., "api/grants/[id]:PATCH". Used for log correlation. */
  route: string;
  /** HTTP method; aids log search. */
  method?: string;
  userId?: string | null;
  organizationId?: string | null;
  /** Override the default status for this kind. */
  status?: number;
  /** Underlying error. Logged only — NEVER in the response body. */
  cause?: unknown;
  /**
   * Extra fields merged into the response body alongside `error` and
   * `correlationId`. Used for routes whose existing error shape carries
   * auxiliary fields (e.g., zod `details`, rate-limit `retryAfter`, a
   * redirect `href`). Keys `error` and `correlationId` on extraBody are
   * ignored so the helper's contract stays authoritative.
   */
  extraBody?: Record<string, unknown>;
  /** Extra response headers (e.g., `Retry-After` on 429). */
  headers?: Record<string, string>;
}

export interface ApiErrorBody {
  error: string;
  correlationId: string;
}

/**
 * Short, URL-safe, unguessable identifier for a single API error event.
 * Format: "req_" + 8 base64url chars (6 random bytes ≈ 2^48 states).
 */
export function generateCorrelationId(): string {
  return "req_" + randomBytes(6).toString("base64url");
}

/**
 * Normalize any thrown value into a JSON-serializable shape. Error
 * instances have non-enumerable own properties, so JSON.stringify(err)
 * returns "{}" by default — which would drop the most useful debug info.
 */
function normalizeCause(cause: unknown): unknown {
  if (cause === undefined || cause === null) return null;
  if (cause instanceof Error) {
    return { name: cause.name, message: cause.message, stack: cause.stack };
  }
  if (typeof cause === "object") {
    try {
      return JSON.parse(JSON.stringify(cause));
    } catch {
      return String(cause);
    }
  }
  return String(cause);
}

/**
 * Construct a NextResponse carrying a user-facing error message + a
 * correlationId, and emit a structured stdout log line for Better Stack
 * to ingest via the Vercel log drain. For kind="internal" we also
 * fire-and-forget captureApiError() so Sentry gets a copy. Expected
 * denials (unauthorized / forbidden / not_found / validation / conflict)
 * are NOT bugs and do not page Sentry.
 */
export function errorResponse(opts: ErrorResponseOpts): NextResponse {
  const correlationId = generateCorrelationId();
  const status = opts.status ?? DEFAULT_STATUS[opts.kind];

  const logPayload = {
    correlationId,
    route: opts.route,
    method: opts.method ?? null,
    kind: opts.kind,
    status,
    message: opts.message,
    userId: opts.userId ?? null,
    organizationId: opts.organizationId ?? null,
    cause: normalizeCause(opts.cause),
    timestamp: new Date().toISOString(),
  };

  console.error("[api_error]", JSON.stringify(logPayload));

  if (opts.kind === "internal") {
    captureApiError(opts.cause, { correlationId, route: opts.route });
  }

  const extra = opts.extraBody ? { ...opts.extraBody } : {};
  delete (extra as Record<string, unknown>).error;
  delete (extra as Record<string, unknown>).correlationId;
  const body = { ...extra, error: opts.message, correlationId };
  return NextResponse.json(body, {
    status,
    ...(opts.headers ? { headers: opts.headers } : {}),
  });
}

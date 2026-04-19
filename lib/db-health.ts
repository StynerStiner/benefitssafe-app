// BSRS Ch 8 P2a — Aurora health probe with per-instance cached result.
//
// Companion to lib/stripe-circuit.ts (P1). Same mental model: per-
// Lambda state, fail-fast, no cross-instance coordination. Differs in
// that we cannot circuit-break the DB the same way — every route needs
// it — so instead we expose a cached health signal that write routes
// check at their entry point (via assertDbHealthy()) and the client-
// side banner polls via /api/health.
//
// Why cached, not per-request:
//   A fresh SELECT 1 on every write route would add ~5-10ms p50 to
//   every mutation. The cache amortizes that to ~once per 30s per
//   Lambda instance while keeping the signal fresh enough to matter.
//
// Why classification by latency, not just up/down:
//   "Down" is the hard gate (writes return 503). "Degraded" is the
//   soft signal (writes still proceed, banner tells the user things
//   are slow). Without the middle tier, a slow-but-functional Aurora
//   either gates every write (harsh) or stays silent (useless). The
//   middle tier lets the UI be honest without being punitive.
//
// Why NOT Redis-backed shared state:
//   Same reasoning as stripe-circuit — per-instance matches the fail-
//   fast goal, and Vercel freeze/thaw already gives us roughly the
//   same "recently-warm instances see recent health" behavior as a
//   cross-instance cache would. Redis-backed shared state is a
//   different PDR if ever needed.

// WARNING: do not import from @/lib/cache — creates cycle with cachedWithStaleness.
import { prisma } from "./db";
import { logger } from "./logger";

// ────────────────────────────────────────────────────────────────────
// Types + configuration
// ────────────────────────────────────────────────────────────────────

export type DbStatus = "healthy" | "degraded" | "down";

export interface DbHealthResult {
  status: DbStatus;
  latencyMs: number;
  checkedAt: Date;
  error?: string;
}

/** How long a cached probe result is considered fresh. */
export const CACHE_TTL_MS = 30_000;

/** Latency ceiling for "healthy" — fast enough nobody notices. */
export const HEALTHY_THRESHOLD_MS = 500;

/** Latency ceiling for "degraded" — slow but functional; writes allowed. */
export const DEGRADED_THRESHOLD_MS = 3_000;

/** Hard kill-timeout for the probe itself. Anything outlasting this is down. */
export const PROBE_TIMEOUT_MS = 5_000;

/** Cooldown hint surfaced as Retry-After seconds when writes are blocked. */
export const DB_UNAVAILABLE_COOLDOWN_MS = 30_000;

// ────────────────────────────────────────────────────────────────────
// Error
// ────────────────────────────────────────────────────────────────────

export class DbUnavailableError extends Error {
  readonly cooldown_ms_remaining: number;
  readonly latency_ms: number;
  constructor(latencyMs: number) {
    super("Aurora is currently unavailable");
    this.name = "DbUnavailableError";
    this.cooldown_ms_remaining = DB_UNAVAILABLE_COOLDOWN_MS;
    this.latency_ms = latencyMs;
  }
}

// ────────────────────────────────────────────────────────────────────
// Module-level cache (per-Lambda instance, per-process)
// ────────────────────────────────────────────────────────────────────

let cached: DbHealthResult | null = null;

function classify(latencyMs: number): DbStatus {
  if (latencyMs < HEALTHY_THRESHOLD_MS) return "healthy";
  if (latencyMs < DEGRADED_THRESHOLD_MS) return "degraded";
  return "down";
}

async function probe(): Promise<DbHealthResult> {
  const start = Date.now();
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  try {
    // Single outer promise settles either on query completion or on
    // the PROBE_TIMEOUT_MS hard kill. Same shape as stripe-circuit's
    // run() — avoids the microtask-ordering edge case where a
    // Promise.race internal handler fires after the test harness
    // observes the timeout rejection.
    await new Promise<void>((resolve, reject) => {
      timeoutHandle = setTimeout(
        () =>
          reject(new Error(`db probe timed out after ${PROBE_TIMEOUT_MS}ms`)),
        PROBE_TIMEOUT_MS,
      );
      (prisma.$queryRaw`SELECT 1` as unknown as Promise<unknown>).then(
        () => resolve(),
        reject,
      );
    });
    const latencyMs = Date.now() - start;
    return {
      status: classify(latencyMs),
      latencyMs,
      checkedAt: new Date(),
    };
  } catch (err) {
    const latencyMs = Date.now() - start;
    return {
      status: "down",
      latencyMs,
      checkedAt: new Date(),
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
  }
}

/**
 * Return the current database health, running a fresh SELECT 1 probe
 * when the cache is stale (> CACHE_TTL_MS old). Emits a structured
 * logger.info("db_health_status_transition") log line when the status
 * *changes* between probes — Better Stack alerts can pattern-match
 * the event name the same way they do for stripe-circuit transitions.
 */
export async function getDbHealth(): Promise<DbHealthResult> {
  if (cached && Date.now() - cached.checkedAt.getTime() < CACHE_TTL_MS) {
    return cached;
  }
  const prev = cached;
  const fresh = await probe();

  if (!prev || prev.status !== fresh.status) {
    logger.info("db_health_status_transition", {
      event: "db_health_status_transition",
      from: prev?.status ?? null,
      to: fresh.status,
      latency_ms: fresh.latencyMs,
      error: fresh.error ?? null,
    });
  }

  cached = fresh;
  return fresh;
}

/**
 * Throw DbUnavailableError when the DB is fully unavailable. Call at
 * the top of write routes before any Prisma operation. "degraded"
 * does NOT throw — writes proceed, and the client-side banner informs
 * the user that things may be slower than usual.
 */
export async function assertDbHealthy(): Promise<void> {
  const { status, latencyMs } = await getDbHealth();
  if (status === "down") {
    throw new DbUnavailableError(latencyMs);
  }
}

// ────────────────────────────────────────────────────────────────────
// Test-only helpers (not part of the public contract)
// ────────────────────────────────────────────────────────────────────

export function __resetForTests(): void {
  cached = null;
}

export function __setCachedForTests(result: DbHealthResult | null): void {
  cached = result;
}

// Job queue backed by Upstash QStash for serverless async processing.
// Falls back to synchronous fetch() if QStash is not configured.

import { Client, Receiver } from "@upstash/qstash";

const qstash =
  process.env.QSTASH_TOKEN
    ? new Client({ token: process.env.QSTASH_TOKEN })
    : null;

// DDIA Ch8 Distributed Systems audit — real QStash HMAC verification.
//
// Previously `verifyJobAuth` treated the mere presence of the
// upstash-signature header as proof of trust. That meant anyone who
// could guess a /api/jobs/* URL could forge a signature header and
// execute the job with arbitrary payload — a security vulnerability as
// well as a reliability one, because genuine QStash retries were being
// "verified" without checking anything about the actual request.
//
// Receiver.verify() performs EdDSA signature verification over the raw
// body + URL using the current + next signing keys.
const qstashReceiver =
  process.env.QSTASH_CURRENT_SIGNING_KEY && process.env.QSTASH_NEXT_SIGNING_KEY
    ? new Receiver({
        currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
        nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY,
      })
    : null;

export interface JobPayload {
  type: string;
  data: Record<string, unknown>;
}

/**
 * Enqueue a background job to be processed by an API route.
 * Uses QStash in production, falls back to direct fetch in dev.
 */
export async function enqueueJob(
  path: string,
  payload: JobPayload,
  options?: { delay?: number; retries?: number },
): Promise<void> {
  const baseUrl =
    process.env.QSTASH_BASE_URL ||
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3002";

  const endpoint = path.startsWith("http") ? path : `${baseUrl}${path}`;

  if (!qstash) {
    // Fallback: process synchronously via direct HTTP call
    try {
      await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-key": process.env.INTERNAL_API_KEY || "",
        },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error(`[queue] sync fallback failed for ${path}:`, err);
    }
    return;
  }

  try {
    await qstash.publishJSON({
      url: endpoint,
      body: payload,
      retries: options?.retries ?? 3,
      delay: options?.delay,
    });
  } catch (err) {
    console.error(`[queue] QStash publish failed for ${path}:`, err);
    // Fallback to sync on QStash failure. Release It! Ch 5 R7 —
    // 5s AbortSignal.timeout matches Postmark's budget. Without this, a
    // slow sync fallback (endpoint unresponsive, TCP blackhole) can hold
    // a money-path Lambda for its full 60s maxDuration, defeating the
    // "async by default" Decoupling Middleware posture. Timeout-driven
    // AbortError propagates to the existing catch block below.
    try {
      await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-key": process.env.INTERNAL_API_KEY || "",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      });
    } catch (fallbackErr) {
      console.error(`[queue] sync fallback also failed for ${path}:`, fallbackErr);
    }
  }
}

/**
 * Verify a request is from QStash (via real EdDSA HMAC) or has a valid
 * internal API key. Async because real HMAC verification must read the
 * raw request body.
 *
 * Returns:
 *   { valid: true, messageId?: string } — caller can proceed
 *   { valid: false }                    — caller must return 401
 *
 * messageId is the QStash `Upstash-Message-Id` header when present; use
 * it as a dedup key in downstream processing (ProcessedJob table pattern).
 */
export async function verifyJobAuth(
  request: Request,
): Promise<{ valid: boolean; messageId?: string }> {
  // Internal API key path (used by cron routes that call us directly).
  const internalKey = request.headers.get("x-internal-key");
  if (internalKey && process.env.INTERNAL_API_KEY && internalKey === process.env.INTERNAL_API_KEY) {
    return { valid: true };
  }

  // Real QStash HMAC verification.
  const upstashSignature = request.headers.get("upstash-signature");
  if (upstashSignature && qstashReceiver) {
    try {
      const bodyText = await request.clone().text();
      const isValid = await qstashReceiver.verify({
        signature: upstashSignature,
        body: bodyText,
        // url is optional but recommended — QStash signs the full URL.
        url: request.url,
      });
      if (isValid) {
        const messageId = request.headers.get("upstash-message-id") || undefined;
        return { valid: true, messageId };
      }
      console.warn("[queue] QStash signature verification returned false");
      return { valid: false };
    } catch (err) {
      console.error("[queue] QStash signature verification threw:", err);
      return { valid: false };
    }
  }

  // Dev fallback: if NEITHER QStash keys NOR internal key are configured,
  // allow (local dev without any auth wiring). Production always has at
  // least INTERNAL_API_KEY set, so this branch never fires in prod.
  if (
    !process.env.QSTASH_CURRENT_SIGNING_KEY &&
    !process.env.QSTASH_NEXT_SIGNING_KEY &&
    !process.env.INTERNAL_API_KEY
  ) {
    return { valid: true };
  }

  return { valid: false };
}

// DDIA Ch8 — Redis-backed dedup for QStash messageId + distributed
// lock for cron. Both use @upstash/redis SET NX EX semantics. Both are
// best-effort: if Redis is unavailable, they return "allow" so cron
// and jobs still run — the underlying operations should be as
// idempotent as possible regardless.
import { redis } from "@/lib/cache";

/**
 * Return true if this QStash messageId has not been processed before.
 * Return false if it has (caller should early-return 200 as a no-op).
 *
 * @param messageId  QStash Upstash-Message-Id header value. If undefined
 *                   (e.g. internal-key request), always returns true.
 * @param ttlSeconds How long to remember the messageId. Pick > the
 *                   QStash retry window (~24h) so a late retry still
 *                   hits the dedup window.
 */
export async function claimJobMessage(
  messageId: string | undefined,
  ttlSeconds = 48 * 3600,
): Promise<boolean> {
  if (!messageId || !redis) return true;
  try {
    const res = await redis.set(`qstash:msg:${messageId}`, "1", {
      nx: true,
      ex: ttlSeconds,
    });
    // @upstash/redis returns "OK" on SET NX success, null if key existed.
    return res === "OK";
  } catch (err) {
    console.error("[queue] claimJobMessage Redis error:", err);
    return true;
  }
}

// Lua script for compare-and-delete — only releases the lock if the value
// still matches our owner token. Prevents a handler whose lock has already
// expired (and been re-acquired by a second instance) from deleting the
// second instance's lock on its way out. Without this, a slow cron that
// exceeded its TTL would unlock a fresh run that had JUST started, allowing
// a third instance to grab the lock and overlap with the second.
// (DDIA Ch9 Consistency & Consensus audit — locks without fencing.)
const RELEASE_IF_OWNER_LUA = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

/**
 * Acquire a distributed lock for a cron handler so two overlapping
 * invocations (Vercel cron + EasyCron retry, platform failover, etc.)
 * don't run in parallel. Returns a release() function on success, or
 * null if the lock is already held.
 *
 * DDIA Ch9 fencing note: this lock uses a per-acquisition owner token so
 * `release()` only deletes the key if it still belongs to us. That
 * prevents the classic "slow worker releases someone else's lock" race
 * where handler A exceeds its TTL, Redis expires the key, handler B
 * acquires the lock, and handler A's belated `release()` silently
 * unlocks handler B. It does NOT provide full fencing tokens (monotonic
 * counters validated on every downstream write) — the cron jobs in this
 * codebase all rely on DB-level entity idempotency (unique constraints,
 * `claimJobMessage`, per-warning `entityId` dedup) as the real line of
 * defense. The owner token is the minimum hardening that keeps the lock
 * itself safe to release.
 *
 * @param name         Stable cron identifier, e.g. "cron:reconciliation".
 * @param ttlSeconds   Safety-net expiration in case the handler crashes
 *                     without releasing. Set longer than the expected
 *                     max runtime.
 */
export async function acquireCronLock(
  name: string,
  ttlSeconds: number,
): Promise<(() => Promise<void>) | null> {
  if (!redis) {
    // No Redis — no lock available; allow run.
    return async () => {};
  }
  // Capture the non-null handle so the closure below isn't subject to
  // narrowing loss after the async boundary.
  const redisClient = redis;
  const key = `cron:lock:${name}`;
  // Unique per-acquisition owner token. `globalThis.crypto` is present in
  // Node 18+ and on Vercel's edge/serverless runtimes.
  const owner = globalThis.crypto.randomUUID();
  try {
    const res = await redisClient.set(key, owner, {
      nx: true,
      ex: ttlSeconds,
    });
    if (res !== "OK") return null;
  } catch (err) {
    console.error("[queue] acquireCronLock Redis error:", err);
    return async () => {};
  }
  return async () => {
    try {
      // Compare-and-delete via Lua. Only deletes if the stored value is
      // still our owner token; otherwise the lock has already expired
      // and been re-acquired, and deleting it would unlock the other
      // instance mid-run.
      await redisClient.eval(RELEASE_IF_OWNER_LUA, [key], [owner]);
    } catch (err) {
      console.error("[queue] cron lock release failed:", err);
    }
  };
}

export const JobTypes = {
  PROCESS_CHARGE: "process_charge",
  RUN_COMPLIANCE: "run_compliance",
  GENERATE_REPORT: "generate_report",
  SEND_NOTIFICATION: "send_notification",
  CHECK_THRESHOLDS: "check_thresholds",
} as const;

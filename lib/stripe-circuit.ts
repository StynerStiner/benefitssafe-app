// BSRS Ch 8 P1 — circuit breaker for outbound Stripe calls.
//
// Wraps Stripe SDK invocations at each call site so a slow or degraded
// Stripe API cannot exhaust Vercel's function concurrency budget. When
// the rolling error rate crosses the threshold, the circuit opens and
// subsequent calls fail fast with CircuitOpenError (mapped to HTTP 503
// + Retry-After by the route's errorResponse(...) call).
//
// Design invariants:
//
//   * Per-instance, per-process. Vercel serverless functions don't share
//     memory, so each warm instance has its own state machine. This is
//     CORRECT for the fail-fast goal: each instance independently
//     detects Stripe slowness based on its own recent calls. Redis-
//     backed shared state is explicitly out of scope (different PDR).
//
//   * MIN_SAMPLES gate. The error-rate threshold only fires after at
//     least MIN_SAMPLES calls land in the window. Without the gate, a
//     cold-start instance whose first call errors would open the
//     circuit at 100% error rate, bailing every subsequent call for
//     30s — way too trigger-happy.
//
//   * Stripe errors pass through. The circuit counts Stripe SDK errors
//     toward the window but does NOT swallow or rewrap them. Route
//     handlers see either Stripe's own error OR CircuitOpenError /
//     CircuitTimeoutError; never both conflated.
//
//   * Interaction with lib/stripe.ts SDK timeout. The Stripe SDK client
//     is configured with timeout: 8000 (DDIA Ch 8 audit). Circuit
//     timeouts of 3s (READ) / 10s (WRITE) compose with that 8s SDK
//     timeout:
//       - READ: circuit timeout (3s) fires first.
//       - WRITE: SDK timeout (8s) usually fires first; the Stripe error
//         propagates up normally and counts toward the error window.
//     Both are correct; document the effective ceiling at each call
//     site if it matters (e.g., latency SLOs).
//
// Exports:
//
//   stripeCircuit           — singleton instance with .run(...)
//   CircuitOpenError        — thrown when the circuit is OPEN
//   CircuitTimeoutError     — thrown when the call exceeds timeoutMs
//   CircuitState / CircuitMode — types for readers
//   Configuration constants (exported so tests + callers share the
//     same source of truth; don't mirror them elsewhere)

import { logger } from "./logger";

// ────────────────────────────────────────────────────────────────────
// Types + configuration
// ────────────────────────────────────────────────────────────────────

export type CircuitState = "closed" | "open" | "half_open";
export type CircuitMode = "read" | "write";

/**
 * Cooldown after the circuit opens. Retry-After header on the 503
 * response derives from this same constant — tune here, not in two
 * places.
 */
export const CIRCUIT_OPEN_COOLDOWN_MS = 30_000;

/** Rolling window size — last N calls evaluated for the error rate. */
export const WINDOW_SIZE = 20;

/** Error rate at or above this value trips the circuit. */
export const ERROR_RATE_THRESHOLD = 0.5;

/**
 * Minimum calls in the window before the error-rate gate fires.
 * Prevents cold-start over-sensitivity: without this gate, the very
 * first call erroring would open the circuit at 1/1 = 100%. Five
 * samples is the smallest number that makes "half the calls are
 * erroring" a statistically meaningful claim in this context.
 */
export const MIN_SAMPLES = 5;

/** Default per-call timeout for READ-class operations (retrieve, list). */
export const DEFAULT_READ_TIMEOUT_MS = 3_000;

/** Default per-call timeout for WRITE-class operations (create/update/delete). */
export const DEFAULT_WRITE_TIMEOUT_MS = 10_000;

// ────────────────────────────────────────────────────────────────────
// Error types
// ────────────────────────────────────────────────────────────────────

export class CircuitOpenError extends Error {
  readonly cooldown_ms_remaining: number;
  readonly label: string;
  constructor(label: string, cooldown_ms_remaining: number) {
    super(
      `Stripe circuit is OPEN — retry in ${Math.ceil(cooldown_ms_remaining / 1000)}s`,
    );
    this.name = "CircuitOpenError";
    this.label = label;
    this.cooldown_ms_remaining = cooldown_ms_remaining;
  }
}

export class CircuitTimeoutError extends Error {
  readonly label: string;
  readonly timeout_ms: number;
  constructor(label: string, timeout_ms: number) {
    super(`Stripe call "${label}" timed out after ${timeout_ms}ms`);
    this.name = "CircuitTimeoutError";
    this.label = label;
    this.timeout_ms = timeout_ms;
  }
}

// ────────────────────────────────────────────────────────────────────
// Circuit implementation (internal)
// ────────────────────────────────────────────────────────────────────

interface WindowEntry {
  timestamp: number;
  errored: boolean;
}

class StripeCircuit {
  private state: CircuitState = "closed";
  private window: WindowEntry[] = [];
  private openedAt: number | null = null;
  private probeInFlight = false;

  async run<T>(
    label: string,
    opts: { mode: CircuitMode; timeoutMs?: number },
    fn: () => Promise<T>,
  ): Promise<T> {
    // Gate: OPEN blocks everything until cooldown elapses, then transitions
    // to HALF_OPEN and allows this call as the probe.
    if (this.state === "open") {
      const elapsed = Date.now() - (this.openedAt ?? 0);
      const remaining = CIRCUIT_OPEN_COOLDOWN_MS - elapsed;
      if (remaining > 0) {
        throw new CircuitOpenError(label, remaining);
      }
      this.transitionTo("half_open", "cooldown_elapsed");
    }

    // HALF_OPEN: only one probe at a time. Concurrent calls fail fast with
    // CircuitOpenError (cooldown_ms_remaining=0 since we're past cooldown
    // but waiting on probe).
    if (this.state === "half_open") {
      if (this.probeInFlight) {
        throw new CircuitOpenError(label, 0);
      }
      this.probeInFlight = true;
    }

    const timeoutMs =
      opts.timeoutMs ??
      (opts.mode === "read"
        ? DEFAULT_READ_TIMEOUT_MS
        : DEFAULT_WRITE_TIMEOUT_MS);

    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    try {
      // Single outer promise settles either on fn completion (resolve /
      // reject) or on timeout. Avoids the microtask-ordering edge case
      // where Promise.race's internal handler fires after the vitest
      // unhandled-rejection tracker observes the timeout rejection.
      const result = await new Promise<T>((resolve, reject) => {
        timeoutHandle = setTimeout(
          () => reject(new CircuitTimeoutError(label, timeoutMs)),
          timeoutMs,
        );
        fn().then(resolve, reject);
      });
      this.recordCall(false);
      if (this.state === "half_open") {
        this.transitionTo("closed", "probe_success");
      }
      return result;
    } catch (err) {
      this.recordCall(true);
      if (this.state === "half_open") {
        this.transitionTo("open", "probe_failure");
      } else if (this.state === "closed") {
        this.evaluateOpen();
      }
      throw err;
    } finally {
      if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
      if (this.probeInFlight) this.probeInFlight = false;
    }
  }

  private recordCall(errored: boolean): void {
    this.window.push({ timestamp: Date.now(), errored });
    if (this.window.length > WINDOW_SIZE) {
      this.window.shift();
    }
  }

  private evaluateOpen(): void {
    if (this.window.length < MIN_SAMPLES) return;
    const errored = this.window.filter((w) => w.errored).length;
    const rate = errored / this.window.length;
    if (rate >= ERROR_RATE_THRESHOLD) {
      this.transitionTo("open", "error_rate_threshold");
    }
  }

  private transitionTo(next: CircuitState, reason: string): void {
    const from = this.state;
    const errored = this.window.filter((w) => w.errored).length;
    const error_rate =
      this.window.length > 0 ? errored / this.window.length : 0;
    this.state = next;
    if (next === "open") {
      this.openedAt = Date.now();
    }
    if (next === "closed") {
      // Probe proved Stripe is healthy again. Reset the window so stale
      // pre-outage errors don't re-trip the circuit on the first fresh
      // error after recovery.
      this.window = [];
      this.openedAt = null;
    }
    logger.info("circuit_state_transition", {
      event: "circuit_state_transition",
      from,
      to: next,
      reason,
      window_size: this.window.length,
      error_rate,
      recent_errors: errored,
    });
  }

  // ──────────────────────────────────────────────────────────────
  // Test-only helpers (not part of the public contract)
  // ──────────────────────────────────────────────────────────────
  __resetForTests(): void {
    this.state = "closed";
    this.window = [];
    this.openedAt = null;
    this.probeInFlight = false;
  }

  __getStateForTests(): CircuitState {
    return this.state;
  }

  __getWindowSizeForTests(): number {
    return this.window.length;
  }
}

export const stripeCircuit = new StripeCircuit();

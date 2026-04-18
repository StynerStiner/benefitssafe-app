import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ──────────────────────────────────────────────────────────────────
// BSRS Ch 8 P1a — circuit state machine tests.
//
// Fake timers run the state machine in virtual time. Both setTimeout
// (for the per-call timeout) and Date.now() (for the OPEN cooldown
// math) are patched by vi.useFakeTimers, so `advanceTimersByTimeAsync`
// moves both together.
// ──────────────────────────────────────────────────────────────────

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

vi.mock("@/lib/logger", () => ({ logger: mockLogger }));

beforeEach(async () => {
  vi.clearAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: false });
  const { stripeCircuit } = await import("@/lib/stripe-circuit");
  stripeCircuit.__resetForTests();
});

afterEach(() => {
  vi.useRealTimers();
});

// Helpers — generate a quick sequence of successful / errored calls
// through the circuit to populate the rolling window.
async function drive(
  count: number,
  errored: boolean,
  mode: "read" | "write" = "read",
): Promise<void> {
  const { stripeCircuit } = await import("@/lib/stripe-circuit");
  for (let i = 0; i < count; i++) {
    try {
      await stripeCircuit.run("test/drive", { mode }, () =>
        errored ? Promise.reject(new Error("stripe went boom")) : Promise.resolve(i),
      );
    } catch {
      // expected when errored = true
    }
  }
}

// ──────────────────────────────────────────────────────────────────
// Group A — CLOSED happy path
// ──────────────────────────────────────────────────────────────────

describe("CLOSED happy path", () => {
  it("passes through a successful call and returns the result", async () => {
    const { stripeCircuit } = await import("@/lib/stripe-circuit");
    const result = await stripeCircuit.run(
      "test/happy",
      { mode: "read" },
      () => Promise.resolve({ id: "card_123" }),
    );
    expect(result).toEqual({ id: "card_123" });
    expect(stripeCircuit.__getStateForTests()).toBe("closed");
  });

  it("propagates a Stripe error and does NOT open circuit on the first error", async () => {
    const { stripeCircuit } = await import("@/lib/stripe-circuit");
    await expect(
      stripeCircuit.run("test/error", { mode: "read" }, () =>
        Promise.reject(new Error("stripe 500")),
      ),
    ).rejects.toThrow("stripe 500");
    expect(stripeCircuit.__getStateForTests()).toBe("closed");
  });

  it("accumulates calls in the window but stays CLOSED while < MIN_SAMPLES", async () => {
    const { stripeCircuit } = await import("@/lib/stripe-circuit");
    // 4 errored calls — below MIN_SAMPLES of 5, so error rate gate does NOT fire.
    await drive(4, true);
    expect(stripeCircuit.__getStateForTests()).toBe("closed");
    expect(stripeCircuit.__getWindowSizeForTests()).toBe(4);
  });
});

// ──────────────────────────────────────────────────────────────────
// Group B — CLOSED → OPEN transition
// ──────────────────────────────────────────────────────────────────

describe("CLOSED → OPEN transition", () => {
  it("opens circuit on the MIN_SAMPLES-th call when error rate crosses threshold", async () => {
    const { stripeCircuit } = await import("@/lib/stripe-circuit");
    // 5 errored calls — at MIN_SAMPLES, error rate = 5/5 = 100% → opens.
    await drive(5, true);
    expect(stripeCircuit.__getStateForTests()).toBe("open");
  });

  it("next run() call throws CircuitOpenError with cooldown_ms_remaining ≈ 30000", async () => {
    const { stripeCircuit, CircuitOpenError, CIRCUIT_OPEN_COOLDOWN_MS } =
      await import("@/lib/stripe-circuit");
    await drive(5, true);
    let caught: unknown;
    try {
      await stripeCircuit.run("test/blocked", { mode: "read" }, () =>
        Promise.resolve("never reaches here"),
      );
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(CircuitOpenError);
    const e = caught as InstanceType<typeof CircuitOpenError>;
    expect(e.cooldown_ms_remaining).toBeGreaterThan(
      CIRCUIT_OPEN_COOLDOWN_MS - 1000,
    );
    expect(e.cooldown_ms_remaining).toBeLessThanOrEqual(CIRCUIT_OPEN_COOLDOWN_MS);
  });

  it("stays CLOSED even with many calls when error rate is below threshold", async () => {
    const { stripeCircuit } = await import("@/lib/stripe-circuit");
    // 15 successful + 4 errored = 19% error rate, under 50% threshold.
    await drive(15, false);
    await drive(4, true);
    expect(stripeCircuit.__getStateForTests()).toBe("closed");
  });
});

// ──────────────────────────────────────────────────────────────────
// Group C — OPEN → HALF_OPEN after cooldown
// ──────────────────────────────────────────────────────────────────

describe("OPEN → HALF_OPEN after cooldown", () => {
  it("allows a probe after 30s virtual time has passed", async () => {
    const { stripeCircuit, CIRCUIT_OPEN_COOLDOWN_MS } = await import(
      "@/lib/stripe-circuit"
    );
    await drive(5, true);
    expect(stripeCircuit.__getStateForTests()).toBe("open");

    await vi.advanceTimersByTimeAsync(CIRCUIT_OPEN_COOLDOWN_MS);

    const result = await stripeCircuit.run(
      "test/probe",
      { mode: "read" },
      () => Promise.resolve("probe ok"),
    );
    expect(result).toBe("probe ok");
    // Success during HALF_OPEN → CLOSED.
    expect(stripeCircuit.__getStateForTests()).toBe("closed");
  });

  it("still throws CircuitOpenError when called 29s after open", async () => {
    const { stripeCircuit, CircuitOpenError } = await import(
      "@/lib/stripe-circuit"
    );
    await drive(5, true);

    await vi.advanceTimersByTimeAsync(29_000);

    await expect(
      stripeCircuit.run("test/still-blocked", { mode: "read" }, () =>
        Promise.resolve("never"),
      ),
    ).rejects.toThrow(CircuitOpenError);
    expect(stripeCircuit.__getStateForTests()).toBe("open");
  });

  it("blocked calls during OPEN do NOT affect the window", async () => {
    const { stripeCircuit } = await import("@/lib/stripe-circuit");
    await drive(5, true);
    const windowSizeAfterOpen = stripeCircuit.__getWindowSizeForTests();
    // Try 10 blocked calls during OPEN — they should all reject without
    // running fn and without touching the window.
    for (let i = 0; i < 10; i++) {
      await stripeCircuit
        .run("test/blocked", { mode: "read" }, () => Promise.resolve("x"))
        .catch(() => {});
    }
    expect(stripeCircuit.__getWindowSizeForTests()).toBe(windowSizeAfterOpen);
  });
});

// ──────────────────────────────────────────────────────────────────
// Group D — HALF_OPEN → CLOSED / OPEN
// ──────────────────────────────────────────────────────────────────

describe("HALF_OPEN → CLOSED / OPEN", () => {
  it("probe success transitions to CLOSED and allows subsequent calls", async () => {
    const { stripeCircuit, CIRCUIT_OPEN_COOLDOWN_MS } = await import(
      "@/lib/stripe-circuit"
    );
    await drive(5, true);
    await vi.advanceTimersByTimeAsync(CIRCUIT_OPEN_COOLDOWN_MS);

    // Probe succeeds → CLOSED.
    await stripeCircuit.run("test/probe", { mode: "read" }, () =>
      Promise.resolve("ok"),
    );
    expect(stripeCircuit.__getStateForTests()).toBe("closed");

    // Next call goes through normally.
    const result = await stripeCircuit.run(
      "test/next",
      { mode: "read" },
      () => Promise.resolve("still ok"),
    );
    expect(result).toBe("still ok");
  });

  it("probe failure transitions back to OPEN with a fresh cooldown", async () => {
    const { stripeCircuit, CircuitOpenError, CIRCUIT_OPEN_COOLDOWN_MS } =
      await import("@/lib/stripe-circuit");
    await drive(5, true);
    await vi.advanceTimersByTimeAsync(CIRCUIT_OPEN_COOLDOWN_MS);

    // Probe fails → back to OPEN.
    await expect(
      stripeCircuit.run("test/probe-fail", { mode: "read" }, () =>
        Promise.reject(new Error("still down")),
      ),
    ).rejects.toThrow("still down");
    expect(stripeCircuit.__getStateForTests()).toBe("open");

    // Next call is blocked with fresh ~30s cooldown.
    let caught: unknown;
    try {
      await stripeCircuit.run("test/after", { mode: "read" }, () =>
        Promise.resolve("x"),
      );
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(CircuitOpenError);
    const e = caught as InstanceType<typeof CircuitOpenError>;
    expect(e.cooldown_ms_remaining).toBeGreaterThan(
      CIRCUIT_OPEN_COOLDOWN_MS - 1000,
    );
  });
});

// ──────────────────────────────────────────────────────────────────
// Group E — Timeout behavior
// ──────────────────────────────────────────────────────────────────

describe("Timeout behavior", () => {
  it("throws CircuitTimeoutError when fn exceeds the timeout", async () => {
    const {
      stripeCircuit,
      CircuitTimeoutError,
      DEFAULT_READ_TIMEOUT_MS,
    } = await import("@/lib/stripe-circuit");

    // fn resolves at 4s; circuit timeout is 3s (READ default).
    const slow = () =>
      new Promise((resolve) =>
        setTimeout(() => resolve("too late"), 4_000),
      );

    const pending = stripeCircuit.run("test/slow", { mode: "read" }, slow);
    // Attach an immediate handler to prevent Node's unhandled-rejection
    // tracker from firing during the virtual-timer advance. The rejection
    // is still inspected by the subsequent expect().rejects assertion.
    pending.catch(() => {});

    await vi.advanceTimersByTimeAsync(DEFAULT_READ_TIMEOUT_MS + 100);

    await expect(pending).rejects.toBeInstanceOf(CircuitTimeoutError);
  });

  it("timeout counts toward the error-rate window", async () => {
    const { stripeCircuit, DEFAULT_READ_TIMEOUT_MS } = await import(
      "@/lib/stripe-circuit"
    );
    const slow = () =>
      new Promise((resolve) =>
        setTimeout(() => resolve("too late"), 10_000),
      );

    // Fire 5 timeout-errored calls — each should count as an error
    // and push the circuit to OPEN at MIN_SAMPLES.
    for (let i = 0; i < 5; i++) {
      const pending = stripeCircuit.run(
        "test/timeout-loop",
        { mode: "read" },
        slow,
      );
      pending.catch(() => {}); // suppress Node unhandled-rejection tracker
      await vi.advanceTimersByTimeAsync(DEFAULT_READ_TIMEOUT_MS + 10);
      await pending.catch(() => {});
    }
    expect(stripeCircuit.__getStateForTests()).toBe("open");
  });
});

// ──────────────────────────────────────────────────────────────────
// Group F — State transition logging
// ──────────────────────────────────────────────────────────────────

describe("State transition logging", () => {
  it("CLOSED → OPEN emits logger.info with error_rate + recent_errors", async () => {
    await drive(5, true);
    const openCall = mockLogger.info.mock.calls.find(
      (c) => c[1]?.to === "open",
    );
    expect(openCall).toBeDefined();
    const payload = openCall![1];
    expect(payload.from).toBe("closed");
    expect(payload.to).toBe("open");
    expect(payload.error_rate).toBeGreaterThanOrEqual(0.5);
    expect(payload.recent_errors).toBe(5);
    expect(payload.reason).toBe("error_rate_threshold");
  });

  it("HALF_OPEN → CLOSED emits logger.info with reason probe_success", async () => {
    const { stripeCircuit, CIRCUIT_OPEN_COOLDOWN_MS } = await import(
      "@/lib/stripe-circuit"
    );
    await drive(5, true);
    await vi.advanceTimersByTimeAsync(CIRCUIT_OPEN_COOLDOWN_MS);
    await stripeCircuit.run("test/probe", { mode: "read" }, () =>
      Promise.resolve("ok"),
    );
    const closedCall = mockLogger.info.mock.calls.find(
      (c) => c[1]?.to === "closed",
    );
    expect(closedCall).toBeDefined();
    expect(closedCall![1].from).toBe("half_open");
    expect(closedCall![1].reason).toBe("probe_success");
  });
});

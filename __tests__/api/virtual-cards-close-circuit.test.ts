import { describe, it, expect, vi, beforeEach } from "vitest";

// ──────────────────────────────────────────────────────────────────
// BSRS Ch 8 P1b Tier 1 — spot-check for circuit → 503 + Retry-After
// on the virtual-cards/[id]/close route. The circuit state machine
// itself is covered by __tests__/lib/stripe-circuit.test.ts (P1a, 15
// tests). This test verifies the INTEGRATION: when the circuit is
// OPEN, the route's outer catch maps to HTTP 503 with a Retry-After
// header and the correct error-response shape.
//
// Strategy: mock @/lib/stripe-circuit so stripeCircuit.run throws
// CircuitOpenError. This bypasses the real state machine (out of
// scope for this test) and drives the route through its circuit-
// error handling path deterministically.
// ──────────────────────────────────────────────────────────────────

class MockCircuitOpenError extends Error {
  readonly cooldown_ms_remaining: number;
  readonly label: string;
  constructor(label: string, cooldown_ms_remaining: number) {
    super("Stripe circuit is OPEN");
    this.name = "CircuitOpenError";
    this.label = label;
    this.cooldown_ms_remaining = cooldown_ms_remaining;
  }
}

class MockCircuitTimeoutError extends Error {
  readonly label: string;
  readonly timeout_ms: number;
  constructor(label: string, timeout_ms: number) {
    super("timeout");
    this.name = "CircuitTimeoutError";
    this.label = label;
    this.timeout_ms = timeout_ms;
  }
}

// `circuitIsOpen` controls whether stripeCircuit.run throws. Flip it
// inside individual tests to simulate the CLOSED vs OPEN state.
const circuitState = { isOpen: false };

vi.mock("@/lib/stripe-circuit", () => ({
  stripeCircuit: {
    run: vi.fn(<T>(
      _label: string,
      _opts: { mode: "read" | "write"; timeoutMs?: number },
      fn: () => Promise<T>,
    ) => {
      if (circuitState.isOpen) {
        return Promise.reject(new MockCircuitOpenError(_label, 28_000));
      }
      return fn();
    }),
  },
  CircuitOpenError: MockCircuitOpenError,
  CircuitTimeoutError: MockCircuitTimeoutError,
  CIRCUIT_OPEN_COOLDOWN_MS: 30_000,
}));

// Stripe SDK — only the call we invoke needs mocking.
vi.mock("@/lib/stripe", () => ({
  stripe: {
    issuing: {
      cards: {
        update: vi.fn(() => Promise.resolve({ id: "ic_test", status: "canceled" })),
      },
    },
  },
}));

vi.mock("@/lib/stripe-helpers", () => ({
  stripeOptsForCard: vi.fn(() => ({})),
}));

// Prisma — minimum surface to traverse the DB work in POST() and
// reach the Stripe call at line ~264.
const txStub = {
  virtualCard: {
    updateMany: vi.fn(() => Promise.resolve({ count: 1 })),
    update: vi.fn(() => Promise.resolve({})),
  },
  ledgerEntry: { create: vi.fn(() => Promise.resolve({})) },
  grant: { update: vi.fn(() => Promise.resolve({})) },
  approval: { update: vi.fn(() => Promise.resolve({})) },
  auditLog: { create: vi.fn(() => Promise.resolve({})) },
};

vi.mock("@/lib/db", () => ({
  prisma: {
    virtualCard: {
      findFirst: vi.fn(() =>
        Promise.resolve({
          id: "card-1",
          organizationId: "org-1",
          status: "ACTIVE",
          stripeCardId: "ic_live_abc",
          issuingMode: "platform",
          expenseRequestId: null,
          grantId: null,
          beneficiaryId: null,
          spendingCap: null,
          spentAmount: 0,
        }),
      ),
    },
    organization: {
      findUnique: vi.fn(() =>
        Promise.resolve({ stripeAccountId: null }),
      ),
    },
    $transaction: vi.fn(
      (callback: (tx: typeof txStub) => Promise<unknown>) => callback(txStub),
    ),
  },
  retryOnSerializationFailure: vi.fn(<T>(fn: () => Promise<T>) => fn()),
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(() =>
    Promise.resolve({
      user: { id: "user-1", role: "nonprofit_admin", organizationId: "org-1" },
    }),
  ),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  circuitState.isOpen = false;
});

async function callPost(): Promise<Response> {
  const { POST } = await import("@/app/api/virtual-cards/[id]/close/route");
  const req = new Request(
    "http://localhost/api/virtual-cards/card-1/close",
    { method: "POST" },
  );
  return POST(req, { params: Promise.resolve({ id: "card-1" }) });
}

describe("virtual-cards/[id]/close × stripe circuit", () => {
  it("happy path: circuit CLOSED, route proceeds normally to 200", async () => {
    circuitState.isOpen = false;
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await callPost();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe("Card closed");
  });

  it("circuit OPEN: returns 503 with Retry-After header", async () => {
    circuitState.isOpen = true;
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await callPost();
    expect(res.status).toBe(503);

    const retryAfter = res.headers.get("Retry-After");
    expect(retryAfter).not.toBeNull();
    const seconds = Number(retryAfter);
    expect(Number.isInteger(seconds)).toBe(true);
    expect(seconds).toBeGreaterThan(0);
    expect(seconds).toBeLessThanOrEqual(30);
  });

  it("circuit OPEN: response body carries the dependency-unavailable error message + correlationId", async () => {
    circuitState.isOpen = true;
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await callPost();
    const body = await res.json();
    expect(body.error).toBe("Stripe is currently unavailable; please retry.");
    expect(body.correlationId).toMatch(/^req_[A-Za-z0-9_-]{8}$/);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

// ──────────────────────────────────────────────────────────────────
// BSRS Ch 8 P4 — tests for the credential_rotation logger.
// The happy path asserts the event shape + latency math. The sanitize
// tests prove that Rule 1 (property names) and Rule 2 (known credential
// prefixes) THROW, while Rule 3 (generic base64-40+) strips the
// offending property and warns. No test ever emits a real credential
// value in a way that would survive the sanitize.
// ──────────────────────────────────────────────────────────────────

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

vi.mock("@/lib/logger", () => ({ logger: mockLogger }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("startRotation", () => {
  it("returns a UUID rotation_id + ISO started_at", async () => {
    const { startRotation } = await import("@/lib/credential-rotation-logger");
    const { rotation_id, started_at } = startRotation({
      credential_kind: "aurora_master",
      operator: "adm.benefitssafe@gmail.com",
      incident: "routine",
    });
    expect(rotation_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(new Date(started_at).toISOString()).toBe(started_at);
    expect(mockLogger.info).toHaveBeenCalledTimes(1);
    const [, payload] = mockLogger.info.mock.calls[0];
    expect(payload.phase).toBe("started");
    expect(payload.credential_kind).toBe("aurora_master");
    expect(payload.incident).toBe("routine");
  });
});

describe("completeRotation", () => {
  it("computes a positive latency < 1s on an immediate call", async () => {
    const { startRotation, completeRotation } = await import(
      "@/lib/credential-rotation-logger"
    );
    const start = startRotation({
      credential_kind: "stripe_live_secret",
      operator: "adm.benefitssafe@gmail.com",
      incident: "routine",
    });
    mockLogger.info.mockClear();
    completeRotation({
      rotation_id: start.rotation_id,
      started_at: start.started_at,
      credential_kind: "stripe_live_secret",
      operator: "adm.benefitssafe@gmail.com",
      incident: "routine",
    });
    expect(mockLogger.info).toHaveBeenCalledTimes(1);
    const [, payload] = mockLogger.info.mock.calls[0];
    expect(payload.phase).toBe("completed");
    expect(payload.latency_ms).toBeGreaterThanOrEqual(0);
    expect(payload.latency_ms).toBeLessThan(1000);
  });
});

describe("failRotation", () => {
  it("emits phase: failed with error_summary via logger.error", async () => {
    const { startRotation, failRotation } = await import(
      "@/lib/credential-rotation-logger"
    );
    const start = startRotation({
      credential_kind: "aws_iam_deployer",
      operator: "adm.benefitssafe@gmail.com",
      incident: "emergency",
    });
    mockLogger.info.mockClear();
    failRotation({
      rotation_id: start.rotation_id,
      started_at: start.started_at,
      credential_kind: "aws_iam_deployer",
      operator: "adm.benefitssafe@gmail.com",
      incident: "emergency",
      error_summary: "aws sts get-caller-identity returned 403 after rotation",
    });
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    const [, payload] = mockLogger.error.mock.calls[0];
    expect(payload.phase).toBe("failed");
    expect(payload.error_summary).toContain("get-caller-identity");
    expect(payload.latency_ms).toBeGreaterThanOrEqual(0);
  });
});

// ──────────────────────────────────────────────────────────────────
// Sanitize — Rule 1 (property-name match)
// ──────────────────────────────────────────────────────────────────

describe("sanitize Rule 1 — credential-shape property names throw", () => {
  for (const propertyName of ["secret", "key", "password", "token", "SECRET", "Password"]) {
    it(`throws when a property named "${propertyName}" is present`, async () => {
      const { startRotation, CredentialInLogError } = await import(
        "@/lib/credential-rotation-logger"
      );
      // Force an extra field by casting — this is exactly the typo we're guarding against.
      const args = {
        credential_kind: "aurora_master" as const,
        operator: "adm.benefitssafe@gmail.com",
        incident: "routine" as const,
        [propertyName]: "value-that-should-never-appear-in-logs",
      } as unknown as Parameters<typeof startRotation>[0];
      expect(() => startRotation(args)).toThrow(CredentialInLogError);
    });
  }
});

// ──────────────────────────────────────────────────────────────────
// Sanitize — Rule 2 (known credential prefixes)
// ──────────────────────────────────────────────────────────────────

describe("sanitize Rule 2 — credential-prefix values throw", () => {
  const cases = [
    ["sk_test_REMOVED_PLACEHOLDER", "sk_live_ Stripe secret prefix"],
    ["whsec_BAKED_fake_webhook_secret_0000000000", "whsec_ webhook secret prefix"],
    ["AKIAIOSFODNN7EXAMPLE", "AKIA AWS access key prefix"],
    ["Bearer fake-bearer-token-would-go-here-000000", "Bearer prefix"],
  ];
  for (const [value, description] of cases) {
    it(`throws on a payload value with ${description}`, async () => {
      const { startRotation, CredentialInLogError } = await import(
        "@/lib/credential-rotation-logger"
      );
      const args = {
        credential_kind: "aurora_master" as const,
        // Use a non-"operator" property to hit a string that's not a valid email.
        operator: value,
        incident: "routine" as const,
      };
      expect(() => startRotation(args)).toThrow(CredentialInLogError);
    });
  }
});

// ──────────────────────────────────────────────────────────────────
// Sanitize — Rule 3 (generic base64-40+, strip and warn)
// ──────────────────────────────────────────────────────────────────

describe("sanitize Rule 3 — generic base64-40+ strips and warns", () => {
  it("strips the offending property, emits the event, and warns", async () => {
    const { startRotation } = await import(
      "@/lib/credential-rotation-logger"
    );
    const extraProperty = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"; // 40 chars of 'A' — matches /^[A-Za-z0-9+/=_-]{40,}$/
    const args = {
      credential_kind: "aurora_master" as const,
      operator: "adm.benefitssafe@gmail.com",
      incident: "routine" as const,
      // Extra property with a base64-40+ value — should be stripped.
      note: extraProperty,
    } as unknown as Parameters<typeof startRotation>[0];

    // Must NOT throw.
    startRotation(args);

    // logger.info was called (event still emitted).
    expect(mockLogger.info).toHaveBeenCalledTimes(1);
    // logger.warn was called with the suspicious-payload message.
    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    const [warnMsg, warnPayload] = mockLogger.warn.mock.calls[0];
    expect(warnMsg).toContain("suspicious payload shape");
    expect(warnPayload.property).toBe("note");
    // The emitted event does NOT carry the stripped property.
    const [, infoPayload] = mockLogger.info.mock.calls[0];
    expect(infoPayload.note).toBeUndefined();
    // But the legitimate fields survive.
    expect(infoPayload.credential_kind).toBe("aurora_master");
  });
});

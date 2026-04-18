import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Sentry is fire-and-forget inside errorResponse; stub so the test doesn't
// open a real Sentry connection.
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("generateCorrelationId (BSRS Ch 5 P4.1)", () => {
  it("returns the 'req_' prefix + 8 base64url chars (12 total)", async () => {
    const { generateCorrelationId } = await import("@/lib/error-response");

    const id = generateCorrelationId();

    expect(id).toMatch(/^req_[A-Za-z0-9_-]{8}$/);
    expect(id.length).toBe(12);
  });

  it("returns different IDs on consecutive calls", async () => {
    const { generateCorrelationId } = await import("@/lib/error-response");

    const a = generateCorrelationId();
    const b = generateCorrelationId();
    const c = generateCorrelationId();

    expect(a).not.toBe(b);
    expect(b).not.toBe(c);
    expect(a).not.toBe(c);
  });

  it("produces IDs that are safe to put in a URL path", async () => {
    const { generateCorrelationId } = await import("@/lib/error-response");

    // base64url never emits /, +, or = — which would need percent-encoding
    for (let i = 0; i < 100; i++) {
      const id = generateCorrelationId();
      expect(id).not.toMatch(/[/+=]/);
    }
  });
});

describe("errorResponse (BSRS Ch 5 P4.1)", () => {
  it("returns 403 with correlationId when kind=forbidden", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { errorResponse } = await import("@/lib/error-response");

    const res = errorResponse({
      kind: "forbidden",
      message: "Forbidden",
      route: "api/test:GET",
      method: "GET",
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("Forbidden");
    expect(body.correlationId).toMatch(/^req_[A-Za-z0-9_-]{8}$/);
  });

  it("returns 401 when kind=unauthorized", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { errorResponse } = await import("@/lib/error-response");

    const res = errorResponse({
      kind: "unauthorized",
      message: "Unauthorized",
      route: "api/test:GET",
    });

    expect(res.status).toBe(401);
  });

  it("returns 400 when kind=validation", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { errorResponse } = await import("@/lib/error-response");

    const res = errorResponse({
      kind: "validation",
      message: "bad input",
      route: "api/test:POST",
    });

    expect(res.status).toBe(400);
  });

  it("returns 404 when kind=not_found", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { errorResponse } = await import("@/lib/error-response");

    const res = errorResponse({
      kind: "not_found",
      message: "nope",
      route: "api/test:GET",
    });

    expect(res.status).toBe(404);
  });

  it("returns 409 when kind=conflict", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { errorResponse } = await import("@/lib/error-response");

    const res = errorResponse({
      kind: "conflict",
      message: "already done",
      route: "api/test:PATCH",
    });

    expect(res.status).toBe(409);
  });

  it("returns 500 when kind=internal", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { errorResponse } = await import("@/lib/error-response");

    const res = errorResponse({
      kind: "internal",
      message: "oops",
      route: "api/test:POST",
      cause: new Error("boom"),
    });

    expect(res.status).toBe(500);
  });

  it("respects status override (e.g., 429 on validation kind)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { errorResponse } = await import("@/lib/error-response");

    const res = errorResponse({
      kind: "validation",
      message: "Rate limited",
      route: "api/test:POST",
      status: 429,
      headers: { "Retry-After": "60" },
    });

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
  });

  it("merges extraBody fields alongside error + correlationId", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { errorResponse } = await import("@/lib/error-response");

    const res = errorResponse({
      kind: "validation",
      message: "Validation failed",
      route: "api/test:POST",
      extraBody: { details: { name: ["required"] }, code: "MISSING_NAME" },
    });

    const body = await res.json();
    expect(body.error).toBe("Validation failed");
    expect(body.correlationId).toMatch(/^req_/);
    expect(body.details).toEqual({ name: ["required"] });
    expect(body.code).toBe("MISSING_NAME");
  });

  it("refuses to let extraBody overwrite error or correlationId", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { errorResponse } = await import("@/lib/error-response");

    const res = errorResponse({
      kind: "forbidden",
      message: "Real message",
      route: "api/test:GET",
      extraBody: {
        error: "attacker-controlled",
        correlationId: "req_attacker",
      },
    });

    const body = await res.json();
    expect(body.error).toBe("Real message");
    expect(body.correlationId).not.toBe("req_attacker");
    expect(body.correlationId).toMatch(/^req_[A-Za-z0-9_-]{8}$/);
  });

  it("emits a single-line [api_error] log with structured JSON payload", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { errorResponse } = await import("@/lib/error-response");

    errorResponse({
      kind: "forbidden",
      message: "Forbidden",
      route: "api/grants/[id]:PATCH",
      method: "PATCH",
      userId: "user-abc",
      organizationId: "org-xyz",
    });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toBe("[api_error]");
    const payload = JSON.parse(spy.mock.calls[0][1] as string);
    expect(payload).toMatchObject({
      route: "api/grants/[id]:PATCH",
      method: "PATCH",
      kind: "forbidden",
      status: 403,
      message: "Forbidden",
      userId: "user-abc",
      organizationId: "org-xyz",
    });
    expect(payload.correlationId).toMatch(/^req_/);
    expect(payload.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("normalizes Error cause to { name, message, stack } (not {})", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { errorResponse } = await import("@/lib/error-response");

    const boom = new Error("something broke");
    errorResponse({
      kind: "internal",
      message: "Internal server error",
      route: "api/test:POST",
      cause: boom,
    });

    const payload = JSON.parse(spy.mock.calls[0][1] as string);
    expect(payload.cause).toMatchObject({
      name: "Error",
      message: "something broke",
    });
    expect(typeof payload.cause.stack).toBe("string");
  });

  it("does NOT call Sentry for expected denial kinds", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const Sentry = await import("@sentry/nextjs");
    const { errorResponse } = await import("@/lib/error-response");

    for (const kind of ["unauthorized", "forbidden", "not_found", "validation", "conflict"] as const) {
      errorResponse({ kind, message: "x", route: "api/test:GET" });
    }

    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("does call Sentry for kind=internal", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const Sentry = await import("@sentry/nextjs");
    const { errorResponse } = await import("@/lib/error-response");

    errorResponse({
      kind: "internal",
      message: "Internal server error",
      route: "api/test:POST",
      cause: new Error("boom"),
    });

    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });

  it("never includes `cause` in the response body", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { errorResponse } = await import("@/lib/error-response");

    const res = errorResponse({
      kind: "internal",
      message: "Internal server error",
      route: "api/test:POST",
      cause: new Error("sensitive stack trace with table names"),
    });

    const body = await res.json();
    expect(body).not.toHaveProperty("cause");
    expect(body).not.toHaveProperty("stack");
    expect(JSON.stringify(body)).not.toContain("table names");
  });
});

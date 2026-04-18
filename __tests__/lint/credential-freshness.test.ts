import { describe, it, expect } from "vitest";

// ──────────────────────────────────────────────────────────────────
// BSRS Ch 8 P4 — unit tests for the freshness-linter pure helpers.
// classifyCredential + parseLedger are exported from the .mjs script
// and invoked here in isolation. CLI-level behavior (--enforce, exit
// codes) is covered by a smoke test in the Checkpoint B report, not
// by vitest — the exit-code behavior is better observed in CI logs
// than asserted with spawn().
// ──────────────────────────────────────────────────────────────────

describe("classifyCredential", () => {
  const NOW = new Date("2026-04-18T00:00:00Z");

  it("returns critical when latestCompletedAt is null (missing from ledger)", async () => {
    const { classifyCredential } = await import(
      "@/scripts/lint/credential-freshness.mjs"
    );
    const r = classifyCredential("aurora_master", null, NOW);
    expect(r.tier).toBe("critical");
    expect(r.days).toBeNull();
    expect(r.reason).toContain("missing from ledger");
  });

  it("returns ok at 99 days", async () => {
    const { classifyCredential } = await import(
      "@/scripts/lint/credential-freshness.mjs"
    );
    const past = new Date(NOW.getTime() - 99 * 86400_000);
    expect(classifyCredential("stripe_live_secret", past, NOW).tier).toBe("ok");
  });

  it("returns warn at 100 days", async () => {
    const { classifyCredential } = await import(
      "@/scripts/lint/credential-freshness.mjs"
    );
    const past = new Date(NOW.getTime() - 100 * 86400_000);
    expect(classifyCredential("stripe_live_secret", past, NOW).tier).toBe(
      "warn",
    );
  });

  it("returns error at 120 days", async () => {
    const { classifyCredential } = await import(
      "@/scripts/lint/credential-freshness.mjs"
    );
    const past = new Date(NOW.getTime() - 120 * 86400_000);
    expect(classifyCredential("stripe_live_secret", past, NOW).tier).toBe(
      "error",
    );
  });

  it("returns critical at 180 days", async () => {
    const { classifyCredential } = await import(
      "@/scripts/lint/credential-freshness.mjs"
    );
    const past = new Date(NOW.getTime() - 180 * 86400_000);
    expect(classifyCredential("stripe_live_secret", past, NOW).tier).toBe(
      "critical",
    );
  });
});

describe("parseLedger", () => {
  it("returns the latest real rotation over the sentinel when both exist", async () => {
    const { parseLedger } = await import(
      "@/scripts/lint/credential-freshness.mjs"
    );
    const ledger = [
      "| credential_kind | rotation_id | started_at | completed_at | latency_ms | operator | incident | notes |",
      "|---|---|---|---|---|---|---|---|",
      "| aurora_master | baseline | 2026-04-17T00:00:00Z | 2026-04-17T00:00:00Z | 0 | adm.benefitssafe@gmail.com | routine | Baseline sentinel — credential in use since platform launch |",
      "| aurora_master | abc-123 | 2026-05-01T10:00:00Z | 2026-05-01T10:06:00Z | 360000 | adm.benefitssafe@gmail.com | routine | First real rotation |",
    ].join("\n");
    const parsed = parseLedger(ledger);
    const latest = parsed.get("aurora_master");
    expect(latest?.toISOString()).toBe("2026-05-01T10:06:00.000Z");
  });

  it("falls back to the sentinel when no real rotation exists", async () => {
    const { parseLedger } = await import(
      "@/scripts/lint/credential-freshness.mjs"
    );
    const ledger = [
      "| credential_kind | rotation_id | started_at | completed_at | latency_ms | operator | incident | notes |",
      "|---|---|---|---|---|---|---|---|",
      "| stripe_live_secret | baseline | 2026-04-17T00:00:00Z | 2026-04-17T00:00:00Z | 0 | adm.benefitssafe@gmail.com | routine | Baseline sentinel — credential in use since platform launch |",
    ].join("\n");
    const parsed = parseLedger(ledger);
    const latest = parsed.get("stripe_live_secret");
    expect(latest?.toISOString()).toBe("2026-04-17T00:00:00.000Z");
  });

  it("omits credentials that have no row at all (not even a sentinel)", async () => {
    const { parseLedger } = await import(
      "@/scripts/lint/credential-freshness.mjs"
    );
    const ledger = [
      "| credential_kind | rotation_id | started_at | completed_at | latency_ms | operator | incident | notes |",
      "|---|---|---|---|---|---|---|---|",
      "| aurora_master | baseline | 2026-04-17T00:00:00Z | 2026-04-17T00:00:00Z | 0 | adm.benefitssafe@gmail.com | routine | Baseline sentinel |",
    ].join("\n");
    const parsed = parseLedger(ledger);
    expect(parsed.has("aurora_master")).toBe(true);
    expect(parsed.has("stripe_live_secret")).toBe(false);
  });
});

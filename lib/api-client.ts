// BSRS Ch 8 P2c — client-side helper for reading staleness metadata
// off any API response that went through `cachedWithStaleness` on the
// server.
//
// Consumers call this on a parsed response body and get back a typed
// shape suitable for rendering a per-card "Last refreshed X ago"
// indicator. The hook `useDegradedMode()` separately exposes the
// platform-wide Aurora status; this helper is for per-response
// staleness, which can diverge (e.g., the cache still holds fresh data
// even after getDbHealth flips back to ok).

export interface StalenessMeta {
  stale: boolean;
  staleSeconds: number;
  cachedAt: string | null;
}

const EMPTY: StalenessMeta = { stale: false, staleSeconds: 0, cachedAt: null };

export function extractStalenessMeta(data: unknown): StalenessMeta {
  if (data === null || typeof data !== "object") return EMPTY;
  const meta = (data as { _meta?: unknown })._meta;
  if (meta === null || typeof meta !== "object") return EMPTY;
  const m = meta as Record<string, unknown>;
  const stale = m.stale === true;
  if (!stale) return EMPTY;
  const staleSeconds =
    typeof m.staleSeconds === "number" && m.staleSeconds >= 0
      ? m.staleSeconds
      : 0;
  const cachedAt = typeof m.cachedAt === "string" ? m.cachedAt : null;
  return { stale: true, staleSeconds, cachedAt };
}

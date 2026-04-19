"use client";

// BSRS Ch 8 P2c — shared polling hook for the /api/health status.
//
// Extracted from components/shared/degraded-banner.tsx so other client
// components can consume the same status without duplicating the 30s
// poll. The banner itself becomes a thin renderer on top of this hook.
//
// Contract: a single interval runs per mounted consumer. At 1.8M-org
// scale we don't coalesce across consumers (e.g., via a React Context)
// because the duplicated poll cost is negligible and the simpler
// per-mount model makes testing trivial.

import { useEffect, useState } from "react";

export type HealthStatus = "ok" | "degraded" | "down";

interface HealthResponse {
  status: HealthStatus;
}

const POLL_INTERVAL_MS = 30_000;

export function useDegradedMode(): { status: HealthStatus } {
  const [status, setStatus] = useState<HealthStatus>("ok");

  useEffect(() => {
    let cancelled = false;

    async function probe() {
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        const body = (await res.json()) as HealthResponse;
        if (!cancelled) setStatus(body.status);
      } catch {
        // Silent on fetch errors — the hook must not become a noise
        // source during transient network issues. Last-known status
        // stays visible.
      }
    }

    probe();
    const interval = setInterval(probe, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return { status };
}

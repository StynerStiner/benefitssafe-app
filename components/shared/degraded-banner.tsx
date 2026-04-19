"use client";

// BSRS Ch 8 P2a — client-side degraded-mode banner.
//
// Renders nothing while the platform is healthy; yellow "slower than
// usual" banner when Aurora is degraded; red "actions unavailable"
// banner when Aurora is down. Tailwind classes mirror
// components/shared/trial-banner.tsx so the three banners stack
// consistently in ClientRoot.
//
// The banner is advisory; it does NOT bypass the server-side gate.
// A user who clicks "retry" during degraded mode still hits
// assertDbHealthy() and gets a 503 when the DB is actually down.
//
// P2c update: the 30s /api/health poll moved into hooks/useDegradedMode.ts
// so other components can subscribe to the same status without
// duplicating the interval.

import { AlertTriangle } from "lucide-react";
import { useDegradedMode } from "@/hooks/useDegradedMode";

export default function DegradedBanner() {
  const { status } = useDegradedMode();

  if (status === "ok") return null;

  const critical = status === "down";
  const baseWrapper =
    "flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 max-w-full overflow-hidden min-w-0";
  const wrapperClass = critical
    ? `${baseWrapper} bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-900`
    : `${baseWrapper} bg-yellow-50 dark:bg-yellow-950/40 border-b border-yellow-200 dark:border-yellow-900`;
  const iconClass = critical
    ? "w-5 h-5 text-red-600 dark:text-red-400 shrink-0"
    : "w-5 h-5 text-yellow-600 dark:text-yellow-400 shrink-0";
  const textClass = critical
    ? "text-sm font-medium text-red-900 dark:text-red-200"
    : "text-sm font-medium text-yellow-900 dark:text-yellow-200";

  return (
    <div className={wrapperClass} role="alert">
      <AlertTriangle className={iconClass} />
      <div className="flex-1 min-w-0 overflow-hidden">
        {critical ? (
          <p className={`${textClass} truncate sm:whitespace-normal`}>
            We&apos;re experiencing database issues. New actions are temporarily unavailable. Existing data is still viewable.
          </p>
        ) : (
          <p className={`${textClass} truncate sm:whitespace-normal`}>
            Some features may be slower than usual. Read-only operations continue normally.
          </p>
        )}
      </div>
    </div>
  );
}

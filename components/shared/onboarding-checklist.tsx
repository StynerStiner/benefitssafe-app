"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Check, Circle, Rocket, X } from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useEffect, useState } from "react";

interface OnboardingStep {
  key: string;
  label: string;
  description: string;
  href: string;
  completed: boolean;
  optional?: boolean;
}

interface OnboardingStatus {
  steps: OnboardingStep[];
  completedCount: number;
  totalCount: number;
  requiredCount: number;
  requiredCompletedCount: number;
  isComplete: boolean;
}

const DISMISS_STORAGE_KEY = "benefitssafe:onboarding:dismissed";
const ADMIN_ROLES = new Set(["nonprofit_admin", "platform_admin"]);

// First-run setup checklist. Appears on the admin dashboard until every
// required step is complete. Users can dismiss it — dismissal persists in
// localStorage (per-browser) so it doesn't nag across sessions. Dismissed
// state clears automatically once isComplete flips true, and users can
// un-dismiss by reloading after clearing localStorage (or once we add a
// "Show setup guide" link in settings as a follow-up).
const OnboardingChecklist = () => {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const isAdmin = role ? ADMIN_ROLES.has(role) : false;

  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!isAdmin) {
      setLoaded(true);
      return;
    }
    try {
      const stored = window.localStorage.getItem(DISMISS_STORAGE_KEY);
      if (stored === "true") setDismissed(true);
    } catch {
      // localStorage unavailable — treat as not dismissed
    }
    fetch("/api/onboarding")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: OnboardingStatus | null) => {
        if (data) setStatus(data);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [isAdmin]);

  const handleDismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_STORAGE_KEY, "true");
    } catch {
      // best effort
    }
  };

  // Hide entirely for non-admins, while loading, or once complete/dismissed.
  if (!isAdmin || !loaded) return null;
  if (!status) return null;
  if (status.isComplete) {
    // Clear any stale dismissed flag now that everything's done so it doesn't
    // linger if the user deletes data later.
    try {
      window.localStorage.removeItem(DISMISS_STORAGE_KEY);
    } catch { /* ignore */ }
    return null;
  }
  if (dismissed) return null;

  const { steps, completedCount, totalCount } = status;
  const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <Card className="card !p-0 border-0 rounded-xl shadow-none mb-6">
      <CardContent className="p-0">
        <div className="border-b border-neutral-200 dark:border-slate-500 py-4 px-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Rocket className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-base mb-0 text-foreground truncate">
                Get your organization set up
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                {completedCount} of {totalCount} complete
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="text-xs text-neutral-500 dark:text-neutral-400 hover:text-foreground flex items-center gap-1 shrink-0"
            aria-label="Dismiss onboarding checklist"
          >
            <X className="w-4 h-4" />
            Dismiss
          </button>
        </div>

        {/* Progress bar */}
        <div className="px-6 pt-4">
          <div className="w-full h-2 rounded-full bg-neutral-100 dark:bg-slate-700 overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${percent}%` }}
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              role="progressbar"
            />
          </div>
        </div>

        {/* Steps */}
        <ul className="p-6 space-y-3">
          {steps.map((step) => {
            const rowClass = step.completed
              ? "bg-green-50/60 dark:bg-green-900/10 border-green-200/60 dark:border-green-800/40"
              : "bg-white dark:bg-slate-800/40 border-neutral-200 dark:border-slate-600 hover:border-primary";
            return (
              <li key={step.key}>
                <Link
                  href={step.href}
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${rowClass}`}
                >
                  <span className="shrink-0 mt-0.5">
                    {step.completed ? (
                      <span className="w-5 h-5 rounded-full bg-green-500 text-white flex items-center justify-center">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    ) : (
                      <Circle className="w-5 h-5 text-neutral-300 dark:text-neutral-500" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm font-semibold ${
                        step.completed
                          ? "text-green-700 dark:text-green-300 line-through"
                          : "text-foreground"
                      }`}
                    >
                      {step.label}
                      {step.optional && (
                        <span className="ml-2 text-xs font-normal text-neutral-400">
                          (optional)
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                      {step.description}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
};

export default OnboardingChecklist;

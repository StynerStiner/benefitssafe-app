"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { AlertTriangle, X } from "lucide-react";

// Banner dismissal is stored in sessionStorage — reappears on next login.
const DISMISS_KEY = "bs-trial-banner-dismissed";

type TrialInfo = {
  inTrial: boolean;
  expired: boolean;
  daysRemaining: number;
};

const TrialBanner = () => {
  const { data: session } = useSession();
  const [dismissed, setDismissed] = useState(false);
  const [trial, setTrial] = useState<TrialInfo | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
    }
  }, []);

  useEffect(() => {
    if (!session?.user) return;

    // Derive trial info from session JWT first (zero network call)
    const sub = (session.user as { subscriptionStatus?: string }).subscriptionStatus;
    const trialEndStr = (session.user as { trialEndDate?: string | null }).trialEndDate;
    const billingStatus = (session.user as { billingStatus?: string | null }).billingStatus;

    // If org has an active paid plan, no banner
    if (billingStatus === "active") {
      setTrial({ inTrial: false, expired: false, daysRemaining: 0 });
      return;
    }

    if (sub !== "trial" || !trialEndStr) {
      setTrial({ inTrial: false, expired: false, daysRemaining: 0 });
      return;
    }

    const trialEnd = new Date(trialEndStr).getTime();
    const now = Date.now();
    const msPerDay = 1000 * 60 * 60 * 24;
    const diffMs = trialEnd - now;
    const daysRemaining = Math.max(0, Math.ceil(diffMs / msPerDay));
    const expired = diffMs <= 0;
    setTrial({ inTrial: !expired, expired, daysRemaining });
  }, [session]);

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(DISMISS_KEY, "1");
    }
  };

  if (!trial || dismissed) return null;
  if (!trial.inTrial && !trial.expired) return null;

  // Colors: red when expired OR <7 days remain, yellow when 7+ days
  const critical = trial.expired || trial.daysRemaining < 7;
  const baseWrapper = "flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 max-w-full overflow-hidden min-w-0";
  const wrapperClass = critical
    ? `${baseWrapper} bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-900`
    : `${baseWrapper} bg-yellow-50 dark:bg-yellow-950/40 border-b border-yellow-200 dark:border-yellow-900`;
  const iconClass = critical
    ? "w-5 h-5 text-red-600 dark:text-red-400 shrink-0"
    : "w-5 h-5 text-yellow-600 dark:text-yellow-400 shrink-0";
  const textClass = critical
    ? "text-sm font-medium text-red-900 dark:text-red-200"
    : "text-sm font-medium text-yellow-900 dark:text-yellow-200";
  const buttonClass = critical
    ? "px-3 py-1.5 text-sm font-semibold rounded-md bg-red-600 hover:bg-red-700 text-white transition-colors"
    : "px-3 py-1.5 text-sm font-semibold rounded-md bg-blue-600 hover:bg-yellow-700 text-white transition-colors";

  return (
    <div className={wrapperClass} role="alert">
      <AlertTriangle className={iconClass} />
      <div className="flex-1 min-w-0 overflow-hidden">
        {trial.expired ? (
          <p className={`${textClass} truncate sm:whitespace-normal`}>
            Your trial has ended. Upgrade to continue using BenefitsSafe.
          </p>
        ) : (
          <p className={`${textClass} truncate sm:whitespace-normal`}>
            {trial.daysRemaining === 1
              ? "1 day left in your free trial."
              : `${trial.daysRemaining} days left in your free trial.`}
            {" "}Upgrade to keep all features.
          </p>
        )}
      </div>
      <Link href="/settings/billing" className={`${buttonClass} shrink-0 whitespace-nowrap`}>
        {trial.expired ? "Choose a Plan" : "Upgrade Now"}
      </Link>
      {!trial.expired && (
        <button
          type="button"
          onClick={handleDismiss}
          className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0"
          aria-label="Dismiss trial banner"
        >
          <X className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
        </button>
      )}
    </div>
  );
};

export default TrialBanner;

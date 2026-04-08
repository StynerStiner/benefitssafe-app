"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TIER_CONFIG, PricingTier, type TierLimits, type TierFeatures } from "@/lib/pricing";
import { Check, X, CreditCard, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

type UsageRow = {
  metric: string;
  label: string;
  current: number;
  limit: number;
  percentage: number;
  atLimit: boolean;
  unlimited: boolean;
};

type BillingStatus = {
  trial: {
    inTrial: boolean;
    expired: boolean;
    daysRemaining: number;
    trialEndDate: string | null;
  };
  effectiveTier: { id: string; name: string; price: number };
  paidTier: { id: string; name: string; price: number };
  billingSubscription: {
    tier: string;
    status: string;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  } | null;
  usage: UsageRow[];
};

const TIER_ORDER: PricingTier[] = [
  PricingTier.FREE,
  PricingTier.SEED,
  PricingTier.CORE,
  PricingTier.NETWORK,
  PricingTier.ENTERPRISE,
];

const FEATURE_LABELS: Record<keyof TierFeatures, string> = {
  composioWorkflows: "Composio Workflows",
  sentinelWatchdog: "Sentinel Watchdog",
  sentinelCompliance: "Sentinel Compliance Engine",
  sentinelReporter: "Sentinel Reporter",
  customMCCRules: "Custom MCC Rules",
  prioritySupport: "Priority Support",
  apiAccess: "API Access",
  whiteLabel: "White Label",
};

const LIMIT_LABELS: Record<keyof TierLimits, string> = {
  maxBeneficiaries: "Beneficiaries",
  maxGrants: "Grants",
  maxExpensesPerMonth: "Expenses per month",
  maxCardsPerMonth: "Cards per month",
  maxTeamMembers: "Team members",
  maxStorageMB: "Storage (MB)",
};

const formatLimit = (n: number): string => (n === -1 ? "Unlimited" : n.toLocaleString());

const formatDate = (iso: string | null): string => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const statusBadgeClass = (status: string): string => {
  switch (status) {
    case "active":
    case "trialing":
      return "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300";
    case "past_due":
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300";
    case "canceled":
    case "unpaid":
      return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300";
    default:
      return "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300";
  }
};

const BillingPage = () => {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgradingTier, setUpgradingTier] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const planParam = searchParams.get("plan");

  useEffect(() => {
    fetch("/api/billing/status")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setStatus(data);
        // Auto-trigger checkout if plan param is set and it's a paid tier
        const paidPlans = ["seed", "core", "network", "enterprise"];
        if (planParam && paidPlans.includes(planParam) && data?.paidTier?.id !== planParam) {
          // Small delay so the page renders first
          setTimeout(() => handleUpgrade(planParam), 500);
        }
      })
      .catch((err) => console.error("Failed to load billing status:", err))
      .finally(() => setLoading(false));
  }, []);

  const handleUpgrade = async (tier: string) => {
    if (tier === status?.paidTier.id) return;
    setUpgradingTier(tier);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        toast.error(err?.error || "Failed to start checkout");
        return;
      }
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setUpgradingTier(null);
    }
  };

  const handleManageBilling = async () => {
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        toast.error(err?.error || "Failed to open billing portal");
        return;
      }
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      toast.error("Something went wrong");
    }
  };

  if (loading) {
    return (
      <>
        <DashboardBreadcrumb title="Billing & Plans" text="Billing & Plans" />
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
        </div>
      </>
    );
  }

  if (!status) {
    return (
      <>
        <DashboardBreadcrumb title="Billing & Plans" text="Billing & Plans" />
        <p className="text-center text-neutral-500 py-16">Failed to load billing status.</p>
      </>
    );
  }

  const currentTierId = status.paidTier.id;
  const effectiveTierId = status.effectiveTier.id;
  const subStatus = status.billingSubscription?.status || "trialing";

  return (
    <>
      <DashboardBreadcrumb title="Billing & Plans" text="Billing & Plans" />

      {/* Current Plan */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-primary" />
                  Current Plan
                </CardTitle>
                <CardDescription>Your active subscription and billing period</CardDescription>
              </div>
              <Badge className={statusBadgeClass(subStatus)}>{subStatus.replace("_", " ")}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-neutral-500 uppercase tracking-wider">Plan</p>
                <p className="text-2xl font-bold text-neutral-900 dark:text-white mt-1">
                  {status.paidTier.name}
                </p>
                <p className="text-sm text-neutral-500 mt-1">
                  ${status.paidTier.price}/month
                </p>
              </div>
              {status.trial.inTrial && (
                <div>
                  <p className="text-xs text-neutral-500 uppercase tracking-wider">Trial Access</p>
                  <p className="text-lg font-semibold text-neutral-900 dark:text-white mt-1">
                    {status.effectiveTier.name} (full access)
                  </p>
                  <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                    {status.trial.daysRemaining} days remaining
                  </p>
                </div>
              )}
              {status.trial.expired && (
                <div>
                  <p className="text-xs text-neutral-500 uppercase tracking-wider">Trial Status</p>
                  <p className="text-lg font-semibold text-red-600 dark:text-red-400 mt-1">
                    Expired
                  </p>
                  <p className="text-sm text-neutral-500 mt-1">
                    Choose a plan to restore access
                  </p>
                </div>
              )}
              {status.billingSubscription?.currentPeriodEnd && (
                <div>
                  <p className="text-xs text-neutral-500 uppercase tracking-wider">Next Billing Date</p>
                  <p className="text-lg font-semibold text-neutral-900 dark:text-white mt-1">
                    {formatDate(status.billingSubscription.currentPeriodEnd)}
                  </p>
                </div>
              )}
              {status.billingSubscription?.cancelAtPeriodEnd && (
                <div>
                  <p className="text-xs text-neutral-500 uppercase tracking-wider">Status</p>
                  <p className="text-sm font-semibold text-red-600 dark:text-red-400 mt-1">
                    Canceling at period end
                  </p>
                </div>
              )}
            </div>
            {status.billingSubscription?.tier && status.billingSubscription.tier !== "free" && (
              <div className="mt-6 flex gap-3">
                <Button variant="outline" onClick={handleManageBilling}>
                  Manage Billing
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Usage Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Plan Summary</CardTitle>
            <CardDescription>Effective tier limits</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(Object.keys(LIMIT_LABELS) as Array<keyof TierLimits>).map((key) => {
              const limit = TIER_CONFIG[effectiveTierId as PricingTier].limits[key];
              return (
                <div key={key} className="flex items-center justify-between text-sm">
                  <span className="text-neutral-600 dark:text-neutral-400">{LIMIT_LABELS[key]}</span>
                  <span className="font-medium text-neutral-900 dark:text-white">
                    {formatLimit(limit)}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Usage vs Limits */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Usage This Period</CardTitle>
          <CardDescription>Current usage against your plan limits</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {status.usage.map((row) => (
              <div key={row.metric}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    {row.label}
                  </span>
                  <span className={`text-sm font-semibold ${row.atLimit ? "text-red-600 dark:text-red-400" : "text-neutral-900 dark:text-white"}`}>
                    {row.current.toLocaleString()} / {formatLimit(row.limit)}
                  </span>
                </div>
                {row.unlimited ? (
                  <div className="h-2 rounded-full bg-green-100 dark:bg-green-950/40" />
                ) : (
                  <div className="h-2 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${row.atLimit ? "bg-red-500" : row.percentage > 0.8 ? "bg-yellow-500" : "bg-primary"}`}
                      style={{ width: `${Math.min(100, row.percentage * 100)}%` }}
                    />
                  </div>
                )}
                {row.atLimit && !row.unlimited && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">Limit reached</p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Plan Comparison */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Compare Plans</CardTitle>
          <CardDescription>Choose the plan that fits your organization</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-700">
                  <th className="text-left py-3 px-4 font-medium text-neutral-600 dark:text-neutral-300">Feature</th>
                  {TIER_ORDER.map((tier) => {
                    const config = TIER_CONFIG[tier];
                    const isCurrent = tier === currentTierId;
                    return (
                      <th key={tier} className="text-center py-3 px-4">
                        <div className={isCurrent ? "text-primary" : "text-neutral-900 dark:text-white"}>
                          <p className="font-bold">{config.name}</p>
                          <p className="text-xs font-normal text-neutral-500 mt-1">
                            ${config.price}/mo
                          </p>
                          {isCurrent && (
                            <Badge className="mt-2 bg-primary/10 text-primary">Current</Badge>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {/* Limits rows */}
                {(Object.keys(LIMIT_LABELS) as Array<keyof TierLimits>).map((key) => (
                  <tr key={key} className="border-b border-neutral-100 dark:border-neutral-800">
                    <td className="py-3 px-4 text-neutral-700 dark:text-neutral-300">
                      {LIMIT_LABELS[key]}
                    </td>
                    {TIER_ORDER.map((tier) => (
                      <td key={tier} className="text-center py-3 px-4 text-neutral-900 dark:text-white">
                        {formatLimit(TIER_CONFIG[tier].limits[key])}
                      </td>
                    ))}
                  </tr>
                ))}
                {/* Features rows */}
                {(Object.keys(FEATURE_LABELS) as Array<keyof TierFeatures>).map((key) => (
                  <tr key={key} className="border-b border-neutral-100 dark:border-neutral-800">
                    <td className="py-3 px-4 text-neutral-700 dark:text-neutral-300">
                      {FEATURE_LABELS[key]}
                    </td>
                    {TIER_ORDER.map((tier) => (
                      <td key={tier} className="text-center py-3 px-4">
                        {TIER_CONFIG[tier].features[key] ? (
                          <Check className="w-4 h-4 text-green-600 dark:text-green-400 mx-auto" />
                        ) : (
                          <X className="w-4 h-4 text-neutral-300 dark:text-neutral-600 mx-auto" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
                {/* Action row */}
                <tr>
                  <td className="py-4 px-4"></td>
                  {TIER_ORDER.map((tier) => {
                    const isCurrent = tier === currentTierId;
                    const isLoading = upgradingTier === tier;
                    return (
                      <td key={tier} className="text-center py-4 px-4">
                        <Button
                          variant={isCurrent ? "outline" : "default"}
                          size="sm"
                          disabled={isCurrent || isLoading || tier === "free"}
                          onClick={() => handleUpgrade(tier)}
                          className="w-full"
                        >
                          {isLoading && <Loader2 className="w-3 h-3 animate-spin mr-2" />}
                          {isCurrent ? "Current Plan" : tier === "free" ? "—" : "Select"}
                        </Button>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
};

export default BillingPage;

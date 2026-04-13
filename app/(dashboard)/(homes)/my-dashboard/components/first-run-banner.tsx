"use client";

import EmptyState from "@/components/shared/empty-state";
import { useDashboardData } from "@/contexts/DashboardDataContext";
import { Sparkles } from "lucide-react";

/**
 * Warm first-run welcome shown ONLY when the beneficiary has no grants,
 * no expenses, and no cards yet. Sets expectations for a user who may be
 * unfamiliar with the platform and could otherwise be confused by a
 * dashboard full of zeros.
 *
 * Silent once any data exists.
 */
export default function BeneficiaryFirstRunBanner() {
  const { data, loading } = useDashboardData();

  if (loading || !data) return null;

  const grantsCount = data.grants?.items?.length ?? 0;
  const expensesCount = data.expenses?.recentItems?.length ?? 0;
  const cardsCount = data.cards?.items?.length ?? 0;

  if (grantsCount > 0 || expensesCount > 0 || cardsCount > 0) return null;

  return (
    <div className="mb-6 rounded-xl bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700">
      <EmptyState
        icon={Sparkles}
        title="Welcome to your dashboard"
        message="Your organization is setting things up for you. Once your grants are approved, you'll see your balance, cards, and recent activity here. There's nothing you need to do right now — we'll let you know when something is ready."
      />
    </div>
  );
}

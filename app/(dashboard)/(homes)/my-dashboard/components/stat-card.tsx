"use client";

import { Card, CardContent } from "@/components/ui/card";
import { ArrowDown, ArrowUp, FileText, Medal, Wallet } from "lucide-react";
import React, { useMemo } from "react";
import { useDashboardData } from "@/contexts/DashboardDataContext";

interface CardData {
  title: string;
  value: string;
  icon: React.ElementType;
  iconBg: string;
  gradientFrom: string;
  growth: string;
  growthIcon: React.ElementType;
  growthColor: string;
  description: string;
}

const StatCard = () => {
  const { data, loading } = useDashboardData();

  const cardsDatas = useMemo<CardData[]>(() => {
    if (!data) return [];

    const grants = data.grants?.items ?? [];
    const expenses = data.expenses?.recentItems ?? [];
    const cards = data.cards?.items ?? [];

    // Personal metrics — API already filters to this beneficiary's data
    const availableBalance = grants.reduce(
      (sum: number, g: Record<string, unknown>) => sum + parseFloat((g.totalAmount as string) || "0") - parseFloat((g.spentAmount as string) || "0"),
      0
    );
    const totalSpent = grants.reduce(
      (sum: number, g: Record<string, unknown>) => sum + parseFloat((g.spentAmount as string) || "0"),
      0
    );
    const pendingExpenses = expenses.filter((e: Record<string, unknown>) => e.status === "PENDING");
    const pendingTotal = pendingExpenses.reduce(
      (sum: number, e: Record<string, unknown>) => sum + parseFloat((e.amount as string) || "0"),
      0
    );
    const activeCards = cards.filter((c: Record<string, unknown>) => c.status === "ACTIVE");

    const formatAmount = (amount: number) =>
      amount >= 1000 ? `$${(amount / 1000).toFixed(1)}k` : `$${amount.toFixed(0)}`;

    return [
      {
        title: "My Grants",
        value: grants.length.toLocaleString(),
        icon: Medal,
        iconBg: "bg-purple-600",
        gradientFrom: "from-purple-600/10",
        growth: `${grants.filter((g: Record<string, unknown>) => g.createdAt && new Date(g.createdAt as string) > new Date(Date.now() - 30 * 86400000)).length} this month`,
        growthIcon: ArrowUp,
        growthColor: "text-green-600 dark:text-green-400",
        description: "Assigned to you",
      },
      {
        title: "Available Balance",
        value: formatAmount(availableBalance),
        icon: Wallet,
        iconBg: "bg-primary",
        gradientFrom: "from-primary/10",
        growth: formatAmount(totalSpent) + " spent",
        growthIcon: ArrowUp,
        growthColor: "text-green-600 dark:text-green-400",
        description: "Across all grants",
      },
      {
        title: "Pending Requests",
        value: pendingExpenses.length.toLocaleString(),
        icon: FileText,
        iconBg: "bg-amber-600",
        gradientFrom: "from-amber-600/10",
        growth: formatAmount(pendingTotal),
        growthIcon: ArrowUp,
        growthColor: "text-amber-600 dark:text-amber-400",
        description: "Awaiting approval",
      },
      {
        title: "Active Cards",
        value: activeCards.length.toLocaleString(),
        icon: Wallet,
        iconBg: "bg-green-600",
        gradientFrom: "from-green-600/10",
        growth: `${cards.length} total`,
        growthIcon: ArrowUp,
        growthColor: "text-green-600 dark:text-green-400",
        description: "Virtual cards",
      },
      {
        title: "My Expenses",
        value: expenses.length.toLocaleString(),
        icon: FileText,
        iconBg: "bg-blue-600",
        gradientFrom: "from-blue-600/10",
        growth: `${expenses.filter((e: Record<string, unknown>) => e.status === "APPROVED" || e.status === "PAID").length} approved`,
        growthIcon: ArrowUp,
        growthColor: "text-green-600 dark:text-green-400",
        description: "Total submitted",
      },
    ];
  }, [data]);

  if (loading) {
    return (
      <div className="col-span-full">
        <p className="text-sm text-neutral-500 text-center py-8">
          Loading statistics...
        </p>
      </div>
    );
  }

  return (
    <>
      {cardsDatas.map((card, index) => (
        <Card
          key={index}
          className={`bg-gradient-to-r ${card.gradientFrom} to-white dark:to-slate-700 p-0 border border-gray-200 dark:border-neutral-700 rounded-md shadow-none`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
                  {card.title}
                </p>
                <h3 className="text-2xl font-bold text-neutral-900 dark:text-white mt-1">
                  {card.value}
                </h3>
              </div>
              <div
                className={`w-12 h-12 ${card.iconBg} rounded-full flex items-center justify-center`}
              >
                <card.icon className="text-white" size={24} />
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm mt-4">
              <span className={`flex items-center gap-1 ${card.growthColor}`}>
                <card.growthIcon
                  fill="currentColor"
                  stroke="none"
                  width={14}
                  height={14}
                />
                {card.growth}
              </span>
              <span className="text-neutral-500 dark:text-neutral-400 text-[13px]">
                {card.description}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </>
  );
};

export default StatCard;

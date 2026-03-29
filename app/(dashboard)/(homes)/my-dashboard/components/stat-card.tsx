"use client";

import { Card, CardContent } from "@/components/ui/card";
import { ArrowDown, ArrowUp, FileText, Medal, UsersRound, Wallet } from "lucide-react";
import React, { useEffect, useState } from "react";

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

interface Grant {
  totalAmount: string;
  spentAmount: string;
  createdAt: string;
}

interface Expense {
  amount: string;
  status: string;
  createdAt: string;
}

interface Beneficiary {
  id: string;
}

const StatCard = () => {
  const [cardsDatas, setCardsDatas] = useState<CardData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [grantsRes, expensesRes, beneficiariesRes] = await Promise.all([
          fetch("/api/grants?limit=100"),
          fetch("/api/expenses?limit=100"),
          fetch("/api/beneficiaries?limit=100"),
        ]);

        const grantsJson = await grantsRes.json();
        const expensesJson = await expensesRes.json();
        const beneficiariesJson = await beneficiariesRes.json();
        const grants = (Array.isArray(grantsJson) ? grantsJson : grantsJson.data ?? []) as Grant[];
        const expenses = (Array.isArray(expensesJson) ? expensesJson : expensesJson.data ?? []) as Expense[];
        const beneficiaries = (Array.isArray(beneficiariesJson) ? beneficiariesJson : beneficiariesJson.data ?? []) as Beneficiary[];

        // Calculate metrics
        const totalAllocated = grants.reduce(
          (sum, g) => sum + parseFloat(g.totalAmount || "0"),
          0
        );
        const totalDisbursed = grants.reduce(
          (sum, g) => sum + parseFloat(g.spentAmount || "0"),
          0
        );
        const approvedExpenses = expenses
          .filter((e) => e.status === "APPROVED" || e.status === "PAID")
          .reduce((sum, e) => sum + parseFloat(e.amount || "0"), 0);

        // Calculate month-over-month growth
        const now = new Date();
        const thisMonth = expenses.filter((e) => {
          const date = new Date(e.createdAt);
          return (
            date.getMonth() === now.getMonth() &&
            date.getFullYear() === now.getFullYear()
          );
        });
        const thisMonthTotal = thisMonth.reduce(
          (sum, e) => sum + parseFloat(e.amount || "0"),
          0
        );

        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthExpenses = expenses.filter((e) => {
          const date = new Date(e.createdAt);
          return (
            date.getMonth() === lastMonth.getMonth() &&
            date.getFullYear() === lastMonth.getFullYear()
          );
        });
        const lastMonthTotal = lastMonthExpenses.reduce(
          (sum, e) => sum + parseFloat(e.amount || "0"),
          0
        );

        const monthGrowth =
          lastMonthTotal > 0
            ? ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100
            : 0;
        const growthTrend = monthGrowth >= 0;

        const data: CardData[] = [
          {
            title: "Total Beneficiaries",
            value: beneficiaries.length.toLocaleString(),
            icon: UsersRound,
            iconBg: "bg-cyan-600",
            gradientFrom: "from-cyan-600/10",
            growth: `${beneficiaries.length > 0 ? "+" : ""}${beneficiaries.length}`,
            growthIcon: ArrowUp,
            growthColor: "text-green-600 dark:text-green-400",
            description: "Total in system",
          },
          {
            title: "Total Grants",
            value: grants.length.toLocaleString(),
            icon: Medal,
            iconBg: "bg-purple-600",
            gradientFrom: "from-purple-600/10",
            growth: `${grants.length > 0 ? "+" : ""}${grants.length}`,
            growthIcon: ArrowUp,
            growthColor: "text-green-600 dark:text-green-400",
            description: "Active grants",
          },
          {
            title: "Allocated Funds",
            value: `$${(totalAllocated / 1000).toFixed(1)}k`,
            icon: Wallet,
            iconBg: "bg-primary",
            gradientFrom: "from-primary/10",
            growth: `+$${(approvedExpenses / 1000).toFixed(1)}k`,
            growthIcon: ArrowUp,
            growthColor: "text-green-600 dark:text-green-400",
            description: "Total allocated",
          },
          {
            title: "Disbursed",
            value: `$${(totalDisbursed / 1000).toFixed(1)}k`,
            icon: FileText,
            iconBg: "bg-green-600",
            gradientFrom: "from-green-600/10",
            growth: `${growthTrend ? "+" : ""}${monthGrowth.toFixed(1)}%`,
            growthIcon: growthTrend ? ArrowUp : ArrowDown,
            growthColor: growthTrend
              ? "text-green-600 dark:text-green-400"
              : "text-red-600 dark:text-red-400",
            description: "Month-over-month",
          },
          {
            title: "Approved Expenses",
            value: `$${(approvedExpenses / 1000).toFixed(1)}k`,
            icon: FileText,
            iconBg: "bg-blue-600",
            gradientFrom: "from-blue-600/10",
            growth: `${expenses.filter((e) => e.status === "APPROVED" || e.status === "PAID").length} approved`,
            growthIcon: ArrowUp,
            growthColor: "text-green-600 dark:text-green-400",
            description: "Total approved",
          },
        ];

        setCardsDatas(data);
      } catch (error) {
        console.error("Failed to fetch dashboard stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

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

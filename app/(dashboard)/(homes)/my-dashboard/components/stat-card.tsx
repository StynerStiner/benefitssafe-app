"use client";

import { Card, CardContent } from "@/components/ui/card";
import { ArrowDown, ArrowUp, FileText, Medal, Wallet } from "lucide-react";
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

const StatCard = () => {
  const [cardsDatas, setCardsDatas] = useState<CardData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [grantsRes, expensesRes, cardsRes] = await Promise.all([
          fetch("/api/grants?limit=100"),
          fetch("/api/expenses?limit=100"),
          fetch("/api/virtual-cards?limit=100"),
        ]);

        const grantsJson = await grantsRes.json();
        const expensesJson = await expensesRes.json();
        const cardsJson = await cardsRes.json();
        const grants = (Array.isArray(grantsJson) ? grantsJson : grantsJson.data ?? []) as Grant[];
        const expenses = (Array.isArray(expensesJson) ? expensesJson : expensesJson.data ?? []) as Expense[];
        const cards = (Array.isArray(cardsJson) ? cardsJson : cardsJson.data ?? []) as { id: string; status: string }[];

        // Personal metrics — API already filters to this beneficiary's data
        const availableBalance = grants.reduce(
          (sum, g) => sum + parseFloat(g.totalAmount || "0") - parseFloat(g.spentAmount || "0"),
          0
        );
        const totalSpent = grants.reduce(
          (sum, g) => sum + parseFloat(g.spentAmount || "0"),
          0
        );
        const pendingExpenses = expenses.filter((e) => e.status === "PENDING");
        const pendingTotal = pendingExpenses.reduce(
          (sum, e) => sum + parseFloat(e.amount || "0"),
          0
        );
        const activeCards = cards.filter((c) => c.status === "ACTIVE");

        const formatAmount = (amount: number) =>
          amount >= 1000 ? `$${(amount / 1000).toFixed(1)}k` : `$${amount.toFixed(0)}`;

        const data: CardData[] = [
          {
            title: "My Grants",
            value: grants.length.toLocaleString(),
            icon: Medal,
            iconBg: "bg-purple-600",
            gradientFrom: "from-purple-600/10",
            growth: `${grants.filter((g) => g.createdAt && new Date(g.createdAt) > new Date(Date.now() - 30 * 86400000)).length} this month`,
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
            growth: `${expenses.filter((e) => e.status === "APPROVED" || e.status === "PAID").length} approved`,
            growthIcon: ArrowUp,
            growthColor: "text-green-600 dark:text-green-400",
            description: "Total submitted",
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

"use client";

import SalesStaticChart from "@/components/charts/sales-static-chart";
import CustomSelect from "@/components/shared/custom-select";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowUp, ArrowDown } from "lucide-react";
import { useMemo } from "react";
import { useDashboardData } from "@/contexts/DashboardDataContext";

const SalesStaticCard = () => {
  const { data, loading } = useDashboardData();

  const { totalDisbursed, growthPercent, dailyAverage, isPositive } = useMemo(() => {
    if (!data) return { totalDisbursed: 0, growthPercent: 0, dailyAverage: 0, isPositive: true };

    const expenses = (data.expenses?.recentItems ?? []) as Array<Record<string, unknown>>;

    // Get current month disbursements
    const now = new Date();
    const thisMonth = expenses.filter((e) => {
      const date = new Date(e.createdAt as string);
      return (
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear() &&
        (e.status === "APPROVED" || e.status === "PAID")
      );
    });
    const thisMonthTotal = thisMonth.reduce(
      (sum, e) => sum + parseFloat((e.amount as string) || "0"),
      0
    );

    // Get last month disbursements for comparison
    const lastMonthDate = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1
    );
    const lastMonthExpenses = expenses.filter((e) => {
      const date = new Date(e.createdAt as string);
      return (
        date.getMonth() === lastMonthDate.getMonth() &&
        date.getFullYear() === lastMonthDate.getFullYear() &&
        (e.status === "APPROVED" || e.status === "PAID")
      );
    });
    const lastMonthTotal = lastMonthExpenses.reduce(
      (sum, e) => sum + parseFloat((e.amount as string) || "0"),
      0
    );

    // Calculate growth
    const growth =
      lastMonthTotal > 0
        ? ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100
        : 0;

    // Calculate daily average
    const daysInMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0
    ).getDate();
    const daily = thisMonthTotal / daysInMonth;

    return {
      totalDisbursed: thisMonthTotal,
      growthPercent: Math.abs(growth),
      dailyAverage: daily,
      isPositive: growth >= 0,
    };
  }, [data]);

  if (loading) {
    return (
      <Card className="card">
        <CardContent className="px-0">
          <p className="text-sm text-neutral-500 text-center py-8">
            Loading disbursement data...
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card">
      <CardContent className="px-0">
        <div className="flex flex-wrap items-center justify-between">
          <h3 className="text-lg mb-0">Disbursement Trends</h3>
          <CustomSelect
            placeholder="Monthly"
            options={["Yearly", "Monthly", "Weekly", "Today"]}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-2">
          <h6 className="mb-0">
            ${(totalDisbursed / 1000).toFixed(1)}k
          </h6>
          <span className={`text-sm font-semibold rounded-full ${isPositive ? "bg-green-100 dark:bg-green-600/25 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-600/50" : "bg-red-100 dark:bg-red-600/25 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-600/50"} px-2 py-1.5 flex items-center gap-1`}>
            {isPositive ? "+" : ""}{growthPercent.toFixed(1)}%{" "}
            {isPositive ? (
              <ArrowUp width={14} height={14} />
            ) : (
              <ArrowDown width={14} height={14} />
            )}
          </span>
          <span className="text-xs font-medium">
            + ${dailyAverage.toLocaleString("en-US", { maximumFractionDigits: 0 })} Per Day
          </span>
        </div>

        <div className="apexcharts-tooltip-style-1 mt-7">
          <SalesStaticChart />
        </div>
      </CardContent>
    </Card>
  );
};

export default SalesStaticCard;

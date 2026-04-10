"use client";

import { Card, CardContent } from '@/components/ui/card';
import React, { useMemo } from 'react';
import { ArrowDown, ArrowUp } from "lucide-react";
import TotalSubscriberChart from '@/components/charts/total-subscriber-chart';
import { useDashboardData } from "@/contexts/DashboardDataContext";

const TotalSubscriberCard = () => {
  const { data, loading } = useDashboardData();

  const { activeCount, growthPercent, dailyRate, isPositive } = useMemo(() => {
    if (!data) return { activeCount: 0, growthPercent: 0, dailyRate: 0, isPositive: true };

    const subscriptions = (data.subscriptions?.items ?? []) as Array<Record<string, unknown>>;

    // Count active subscriptions
    const active = subscriptions.filter((s) => s.status === "ACTIVE").length;

    // Get this month subscriptions
    const now = new Date();
    const thisMonth = subscriptions.filter((s) => {
      const date = new Date(s.createdAt as string);
      return (
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear()
      );
    });

    // Get last month subscriptions
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthSubs = subscriptions.filter((s) => {
      const date = new Date(s.createdAt as string);
      return (
        date.getMonth() === lastMonthDate.getMonth() &&
        date.getFullYear() === lastMonthDate.getFullYear()
      );
    });

    // Calculate growth
    const growth =
      lastMonthSubs.length > 0
        ? ((thisMonth.length - lastMonthSubs.length) / lastMonthSubs.length) * 100
        : 0;

    // Calculate daily rate
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daily = thisMonth.length / daysInMonth;

    return {
      activeCount: active,
      growthPercent: Math.abs(growth),
      dailyRate: daily,
      isPositive: growth >= 0,
    };
  }, [data]);

  if (loading) {
    return (
      <Card className="card">
        <CardContent className="card-body p-0">
          <p className="text-sm text-neutral-500 text-center py-8">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card">
      <CardContent className="card-body p-0">
        <h3 className="mb-3 font-semibold text-lg">Active Subscriptions</h3>
        <div className="flex items-center gap-2 mb-5">
          <h6 className="font-semibold mb-0">{activeCount.toLocaleString()}</h6>
          <span className={`text-sm font-semibold rounded-full ${isPositive ? "bg-green-100 dark:bg-green-600/25 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-600/50" : "bg-red-100 dark:bg-red-600/25 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-600/50"} px-2 py-1.5 line-height-1 flex items-center gap-1`}>
            {growthPercent.toFixed(1)}% {isPositive ? <ArrowUp width={14} height={14} /> : <ArrowDown width={14} height={14} />}
          </span>
          - {dailyRate.toFixed(0)} Per Day
        </div>

        <TotalSubscriberChart />

      </CardContent>
    </Card>
  );
};

export default TotalSubscriberCard;
"use client";

import CommonLink from "@/components/shared/common-link";
import { Card, CardContent } from "@/components/ui/card";
import { useMemo } from "react";
import { useDashboardData } from "@/contexts/DashboardDataContext";

interface TopGrant {
  id: string;
  name: string;
  totalAmount: number;
  expenseCount: number;
}

const TopPerformerCard = () => {
  const { data, loading } = useDashboardData();

  const topGrants = useMemo<TopGrant[]>(() => {
    if (!data) return [];
    const grants = (data.grants?.items ?? []) as Array<Record<string, unknown>>;

    // Sort by total amount and get top 6
    return grants
      .map((g) => ({
        id: g.id as string,
        name: g.name as string,
        totalAmount: parseFloat((g.totalAmount as string) || "0"),
        expenseCount: ((g._count as Record<string, number> | undefined)?.expenses) || 0,
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 6);
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

  if (topGrants.length === 0) {
    return (
      <Card className="card">
        <CardContent className="card-body p-0">
          <p className="text-sm text-neutral-500 text-center py-8">No grants yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card">
      <CardContent className="card-body p-0">
        <div className="flex items-center justify-between">
          <h3 className="mb-3 font-semibold text-lg">Top Grants</h3>
          <CommonLink />
        </div>

        <div className="mt-4 space-y-6">
          {topGrants.map((grant, index) => {
            const colors = [
              "bg-blue-600",
              "bg-purple-600",
              "bg-green-600",
              "bg-orange-600",
              "bg-pink-600",
              "bg-indigo-600",
            ];
            const initials = grant.name
              .split(" ")
              .slice(0, 2)
              .map((w) => w[0])
              .join("")
              .toUpperCase();

            return (
              <div
                className="flex items-center justify-between gap-2"
                key={grant.id}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full shrink-0 overflow-hidden ${colors[index]} flex items-center justify-center text-white font-semibold text-sm`}
                  >
                    {initials}
                  </div>
                  <div className="grow">
                    <h6 className="text-base mb-0 font-medium">{grant.name}</h6>
                    <span className="text-sm text-neutral-500 dark:text-neutral-300 font-medium">
                      {grant.expenseCount} expenses
                    </span>
                  </div>
                </div>
                <span className="text-neutral-600 dark:text-neutral-100 text-base font-medium">
                  ${(grant.totalAmount / 1000).toFixed(1)}k
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default TopPerformerCard;

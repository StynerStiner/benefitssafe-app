"use client";

import CommonLink from "@/components/shared/common-link";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useState } from "react";

interface Grant {
  id: string;
  name: string;
  totalAmount: string;
  _count?: { expenses?: number };
}

interface TopGrant {
  id: string;
  name: string;
  totalAmount: number;
  expenseCount: number;
}

const TopPerformerCard = () => {
  const [topGrants, setTopGrants] = useState<TopGrant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/grants?limit=100");
        const json = await res.json();
        const grants = (Array.isArray(json) ? json : json.data ?? []) as Grant[];

        // Sort by total amount and get top 6
        const top = grants
          .map((g) => ({
            id: g.id,
            name: g.name,
            totalAmount: parseFloat(g.totalAmount || "0"),
            expenseCount: g._count?.expenses || 0,
          }))
          .sort((a, b) => b.totalAmount - a.totalAmount)
          .slice(0, 6);

        setTopGrants(top);
      } catch (error) {
        console.error("Failed to fetch top grants:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

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
          <h6 className="mb-3 font-semibold text-lg">Top Grants</h6>
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

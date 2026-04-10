"use client";

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import CustomSelect from '@/components/shared/custom-select';
import { ArrowUp } from 'lucide-react';
import React from 'react';
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import CoinAnalyticsChart from '@/components/charts/coin-analytics-chart';

interface GrantData {
    id: string;
    name: string;
    totalAmount: string;
    spentAmount: string;
    remainingAmount: string;
    createdAt: string;
}

function filterByPeriod<T extends { createdAt: string }>(items: T[], period: string): T[] {
  const now = new Date();
  return items.filter(item => {
    const date = new Date(item.createdAt);
    switch (period) {
      case "Today": return date.toDateString() === now.toDateString();
      case "Weekly": return now.getTime() - date.getTime() < 7 * 24 * 60 * 60 * 1000;
      case "Monthly": return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      case "Yearly": return date.getFullYear() === now.getFullYear();
      default: return true;
    }
  });
}

const CoinAnalyticsCard = ({ grants }: { grants: GrantData[] }) => {
    const [period, setPeriod] = useState("Yearly");
    const filtered = filterByPeriod(grants, period);
    // Find the largest grant by totalAmount
    const sortedGrants = [...filtered].sort(
        (a, b) => parseFloat(b.totalAmount) - parseFloat(a.totalAmount)
    );
    const topGrant = sortedGrants[0];
    const topAmount = topGrant
        ? parseFloat(topGrant.remainingAmount).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 })
        : "$0";
    const topName = topGrant?.name ?? "No Grants";
    const spentPct = topGrant
        ? Math.round((parseFloat(topGrant.spentAmount) / parseFloat(topGrant.totalAmount)) * 100)
        : 0;
    const remainingPct = topGrant ? 100 - spentPct : 0;

    return (
        <Card className="card h-full rounded-lg border-0">
            <CardContent className="card-body p-0">
                <div className="flex items-center flex-wrap gap-2 justify-between">
                    <h3 className="mb-0 font-bold text-lg">Grant Balances</h3>

                    <RadioGroup defaultValue={sortedGrants[0]?.id ?? "all"} className='flex items-center gap-4'>
                        {sortedGrants.slice(0, 3).map((g, i) => (
                            <div key={g.id} className="flex items-center space-x-2">
                                <RadioGroupItem value={g.id} id={`grant-${i}`} className='border border-primary' />
                                <Label htmlFor={`grant-${i}`}>{g.name.length > 12 ? g.name.slice(0, 12) + "..." : g.name}</Label>
                            </div>
                        ))}
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="all" id="all" className='border border-primary' />
                            <Label htmlFor="all">All</Label>
                        </div>
                    </RadioGroup>

                    <CustomSelect
                        placeholder="Yearly"
                        options={["Yearly", "Monthly", "Weekly", "Today"]}
                        value={period}
                        onValueChange={setPeriod}
                    />
                </div>

                <div className="flex items-center gap-2 mt-3">
                    <h6 className="font-semibold mb-0">{topAmount}</h6>
                    <p className="text-sm mb-0 flex items-center gap-1">
                        {topName}
                        <span className="bg-green-100 dark:bg-green-600/25 border border-green-600/25 px-2.5 py-1 rounded-full font-semibold text-green-600 dark:text-green-500 text-sm inline-flex items-center gap-1">
                            {remainingPct}%
                            <ArrowUp className="w-3 h-3" />
                        </span>
                    </p>
                </div>

                <CoinAnalyticsChart />

            </CardContent>
        </Card>
    );
};

export default CoinAnalyticsCard;
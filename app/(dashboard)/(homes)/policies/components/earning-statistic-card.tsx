"use client";

import { useState } from 'react';
import DoubleLineChartTwo from '@/components/charts/double-line-chart-two';
import CustomSelect from '@/components/shared/custom-select';
import { Card, CardContent } from '@/components/ui/card';

interface Grant {
    totalAmount: string;
    spentAmount: string;
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

const EarningStatisticCard = ({ grants }: { grants: Grant[] }) => {
    const [period, setPeriod] = useState("Yearly");
    const filtered = filterByPeriod(grants, period);
    // Calculate total allowed spending (total budgets) and remaining/blocked amounts
    const totalAllowed = filtered.reduce((sum, g) => sum + parseFloat(g.totalAmount || "0"), 0);
    const totalSpent = filtered.reduce((sum, g) => sum + parseFloat(g.spentAmount || "0"), 0);
    const totalRemaining = totalAllowed - totalSpent;

    const formatCurrency = (amount: number) =>
        `$${amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

    return (
        <Card className="card h-full rounded-lg border-0 !p-0">
            <CardContent className="card-body p-6">
                <div className="flex items-center flex-wrap gap-2 justify-between pb-6">
                    <h3 className="mb-0 font-bold text-lg">Allowed Categories</h3>
                    <CustomSelect
                        placeholder="Yearly"
                        options={["Yearly", "Monthly", "Weekly", "Today"]}
                        value={period}
                        onValueChange={setPeriod}
                    />
                </div>

                <ul className="flex flex-wrap items-center justify-center mb-3 gap-3">
                    <li className="flex items-center gap-2">
                        <span className="w-[12px] h-[8px] rounded-[50rem] bg-blue-600"></span>
                        <span className="text-neutral-600 dark:text-neutral-300 text-sm font-semibold">Allowed
                            <span className="text-blue-light font-bold text-xl ms-1">{formatCurrency(totalAllowed)}</span>
                        </span>
                    </li>
                    <li className="flex items-center gap-2">
                        <span className="w-[12px] h-[8px] rounded-[50rem] bg-yellow-500"></span>
                        <span className="text-neutral-600 dark:text-neutral-300 text-sm font-semibold">Remaining
                            <span className="text-blue-light font-bold text-xl ms-1"> {formatCurrency(totalRemaining)}</span>
                        </span>
                    </li>
                </ul>

                <DoubleLineChartTwo colors={["#487FFF", "#FF9F29"]} chartHeight="200" />

            </CardContent>
        </Card>
    );
};

export default EarningStatisticCard;
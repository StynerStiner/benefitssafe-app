"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";

interface Expense {
    riskClassification: string | null;
    createdAt: string;
}

function filterByMonth(items: Expense[], month: number, year: number) {
    return items.filter(item => {
        const date = new Date(item.createdAt);
        return date.getMonth() === month && date.getFullYear() === year;
    });
}

const riskColors: Record<string, string> = {
    LIKELY_SAFE: "bg-green-500",
    NEEDS_REVIEW: "bg-yellow-500",
    LIKELY_RISKY: "bg-orange-500",
    BLOCKED: "bg-red-500",
    PENDING: "bg-neutral-400",
};

const riskLabels: Record<string, string> = {
    LIKELY_SAFE: "Likely Safe",
    NEEDS_REVIEW: "Needs Review",
    LIKELY_RISKY: "Likely Risky",
    BLOCKED: "Blocked",
    PENDING: "Unclassified",
};

const DistributionMapsCard = ({ expenses, selectedMonth, selectedYear }: { expenses: Expense[]; selectedMonth: number; selectedYear: number }) => {
    const filtered = useMemo(
        () => filterByMonth(expenses, selectedMonth, selectedYear),
        [expenses, selectedMonth, selectedYear]
    );

    // Count by risk level
    const riskMap = new Map<string, number>();
    for (const e of filtered) {
        const level = e.riskClassification || "PENDING";
        riskMap.set(level, (riskMap.get(level) || 0) + 1);
    }

    const riskItems = Array.from(riskMap.entries())
        .sort((a, b) => b[1] - a[1]);

    const total = filtered.length;

    return (
        <Card className="card h-full rounded-lg border-0 !p-0">
            <CardContent className="card-body p-0">
                <div className="flex items-center flex-wrap gap-2 justify-between p-6">
                    <h6 className="mb-0 font-bold text-lg">Compliance Risk Overview</h6>
                </div>

                <div className="bg-neutral-100 dark:bg-slate-700/50 p-6">
                    {/* Stacked bar */}
                    <div className="flex rounded-full overflow-hidden h-4">
                        {riskItems.map(([level, count]) => {
                            const pct = total > 0 ? (count / total) * 100 : 0;
                            return (
                                <div
                                    key={level}
                                    className={`${riskColors[level] || "bg-neutral-400"} h-4`}
                                    style={{ width: `${pct}%` }}
                                    title={`${riskLabels[level] || level}: ${count}`}
                                ></div>
                            );
                        })}
                    </div>
                    <p className="text-xs text-neutral-500 mt-2 text-center">{total} total expenses classified</p>
                </div>

                <div className="max-h-[266px] overflow-y-auto p-6 scrollbar-thin scrollbar-invisible hover:scrollbar-visible">
                    <div className="flex flex-col gap-4">
                        {riskItems.map(([level, count]) => {
                            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                            return (
                                <div key={level} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className={`w-3 h-3 rounded-full ${riskColors[level] || "bg-neutral-400"}`}></span>
                                        <span className="text-sm text-neutral-600 dark:text-neutral-300">
                                            {riskLabels[level] || level}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-semibold">{count}</span>
                                        <span className="text-xs text-neutral-500">({pct}%)</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

            </CardContent>
        </Card>
    );
};

export default DistributionMapsCard;

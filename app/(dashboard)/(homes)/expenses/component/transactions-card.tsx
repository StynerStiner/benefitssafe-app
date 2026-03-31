"use client";

import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import CustomSelect from "@/components/shared/custom-select";

interface Expense {
    category: { name: string } | null;
    amount: string;
    createdAt: string;
}

function filterByPeriod(items: any[], period: string) {
    const now = new Date();
    return items.filter((item) => {
        const date = new Date(item.createdAt);
        switch (period) {
            case "Today":
                return date.toDateString() === now.toDateString();
            case "This Week":
            case "Weekly": {
                const weekAgo = new Date(now);
                weekAgo.setDate(now.getDate() - 7);
                return date >= weekAgo;
            }
            case "This Month":
            case "Monthly": {
                const monthAgo = new Date(now);
                monthAgo.setMonth(now.getMonth() - 1);
                return date >= monthAgo;
            }
            case "Last Month": {
                const twoMonthsAgo = new Date(now);
                twoMonthsAgo.setMonth(now.getMonth() - 2);
                const oneMonthAgo = new Date(now);
                oneMonthAgo.setMonth(now.getMonth() - 1);
                return date >= twoMonthsAgo && date < oneMonthAgo;
            }
            case "This Year":
            case "Yearly":
            default: {
                const yearAgo = new Date(now);
                yearAgo.setFullYear(now.getFullYear() - 1);
                return date >= yearAgo;
            }
        }
    });
}

const TransactionsCard = ({ expenses }: { expenses: Expense[] }) => {
    const [period, setPeriod] = useState("This Month");

    const filtered = useMemo(
        () => filterByPeriod(expenses, period) as Expense[],
        [expenses, period]
    );

    // Group by category
    const catMap = new Map<string, { count: number; total: number }>();
    for (const e of filtered) {
        const name = e.category?.name || "Uncategorized";
        const existing = catMap.get(name) || { count: 0, total: 0 };
        existing.count += 1;
        existing.total += parseFloat(e.amount || "0");
        catMap.set(name, existing);
    }

    const categories = Array.from(catMap.entries())
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 6);

    const colors = ["bg-blue-600", "bg-green-500", "bg-yellow-500", "bg-purple-500", "bg-red-500", "bg-cyan-500"];

    return (
        <Card className="card h-full rounded-lg border-0">
            <CardContent className="card-body p-0">
                <div className="flex items-center flex-wrap gap-2 justify-between">
                    <h6 className="mb-0 font-bold text-lg">Expenses by Category</h6>
                    <CustomSelect
                        placeholder="This Month"
                        value={period}
                        onValueChange={setPeriod}
                        options={["This Month", "Last Month", "This Year", "This Week"]}
                    />
                </div>

                <div className="mt-6">
                    {categories.length === 0 ? (
                        <p className="text-sm text-neutral-500">No expenses found</p>
                    ) : (
                        <div className="flex flex-col gap-4">
                            {categories.map(([name, data], i) => (
                                <div key={name} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className={`w-2.5 h-2.5 rounded-full ${colors[i % colors.length]}`}></span>
                                        <span className="text-sm text-neutral-600 dark:text-neutral-300">{name}</span>
                                    </div>
                                    <div className="text-end">
                                        <span className="text-sm font-semibold">${data.total.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
                                        <span className="text-xs text-neutral-500 ml-2">({data.count})</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

            </CardContent>
        </Card>
    );
};

export default TransactionsCard;

"use client";

import { useState } from "react";
import ExpenseStatisticsChart from "@/components/charts/expense-statistics-chart";
import CustomSelect from "@/components/shared/custom-select";
import { Card, CardContent } from "@/components/ui/card";

interface Expense {
    status: string;
    createdAt: string;
}

function filterByPeriod(items: any[], period: string) {
    const now = new Date();
    return items.filter((item) => {
        const date = new Date(item.createdAt);
        switch (period) {
            case "Today":
                return date.toDateString() === now.toDateString();
            case "Weekly": {
                const weekAgo = new Date(now);
                weekAgo.setDate(now.getDate() - 7);
                return date >= weekAgo;
            }
            case "Monthly": {
                const monthAgo = new Date(now);
                monthAgo.setMonth(now.getMonth() - 1);
                return date >= monthAgo;
            }
            case "Yearly":
            default: {
                const yearAgo = new Date(now);
                yearAgo.setFullYear(now.getFullYear() - 1);
                return date >= yearAgo;
            }
        }
    });
}

const ExpenseStatisticsCard = ({ expenses }: { expenses: Expense[] }) => {
    const [period, setPeriod] = useState("Yearly");

    const filtered = filterByPeriod(expenses, period);

    const pending = filtered.filter((e) => e.status === "PENDING").length;
    const approved = filtered.filter((e) => e.status === "APPROVED").length;
    const rejected = filtered.filter((e) => e.status === "REJECTED").length;
    const paid = filtered.filter((e) => e.status === "PAID").length;

    return (
        <Card className="card h-full rounded-lg border-0 !p-0 block">
            <CardContent className="card-body p-0 h-full">
                <div>
                    <div className="card-header border-b border-neutral-200 dark:border-slate-500 py-3 px-6">
                        <div className="flex items-center flex-wrap gap-2 justify-between">
                            <h6 className="font-bold text-lg mb-0">Expense Status</h6>
                            <CustomSelect
                                placeholder="Yearly"
                                options={["Yearly", "Monthly", "Weekly", "Today"]}
                                value={period}
                                onValueChange={setPeriod}
                            />
                        </div>
                    </div>

                    <div className="p-6">
                        <div className="flex flex-wrap items-center justify-center gap-4 mb-4">
                            <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500"></span>
                                <span className="text-xs text-neutral-600 dark:text-neutral-300">Pending ({pending})</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>
                                <span className="text-xs text-neutral-600 dark:text-neutral-300">Approved ({approved})</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                                <span className="text-xs text-neutral-600 dark:text-neutral-300">Rejected ({rejected})</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                                <span className="text-xs text-neutral-600 dark:text-neutral-300">Paid ({paid})</span>
                            </div>
                        </div>
                        <ExpenseStatisticsChart series={[pending, approved, rejected, paid]} />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default ExpenseStatisticsCard;

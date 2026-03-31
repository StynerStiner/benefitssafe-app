"use client";

import { useState, useMemo } from "react";
import CustomersStatisticsChart from "@/components/charts/customers-statistics-chart";
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

const CustomersStatisticsCard = ({ expenses }: { expenses: Expense[] }) => {
    const [period, setPeriod] = useState("Yearly");

    const filtered = useMemo(
        () => filterByPeriod(expenses, period) as Expense[],
        [expenses, period]
    );

    const approved = filtered.filter((e) => e.status === "APPROVED" || e.status === "PAID").length;
    const pending = filtered.filter((e) => e.status === "PENDING").length;
    const total = filtered.length;
    const approvedPct = total > 0 ? Math.round((approved / total) * 100) : 0;
    const pendingPct = total > 0 ? Math.round((pending / total) * 100) : 0;

    return (
        <Card className="card h-full rounded-lg border-0">
            <CardContent className="card-body p-0">
                <div className="flex items-center flex-wrap gap-2 justify-between">
                    <h6 className="mb-0 font-bold text-lg">Expense Statistics</h6>
                    <CustomSelect
                        placeholder="Yearly"
                        value={period}
                        onValueChange={setPeriod}
                        options={["Yearly", "Monthly", "Weekly", "Today"]}
                    />
                </div>

                <div className="relative">
                    <span className="w-[80px] h-[80px] bg-white dark:bg-slate-700 shadow-lg text-neutral-600 dark:text-neutral-200 font-semibold text-xl flex justify-center items-center rounded-full absolute end-0 top-0 z-1 me-11 mt-6">+{approvedPct}%</span>
                    <div className="mt-9 grow apexcharts-tooltip-z-none title-style circle-none">
                        <CustomersStatisticsChart />
                    </div>
                    <span className="w-[80px] h-[80px] bg-white dark:bg-slate-700 shadow-lg text-neutral-600 dark:text-neutral-200 font-semibold text-xl flex justify-center items-center rounded-full absolute start-0 bottom-0 z-1 mb-6 ms-14">+{pendingPct}%</span>
                </div>

                <ul className="flex flex-wrap items-center justify-between mt-4 gap-3">
                    <li className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-xs bg-blue-500"></span>
                        <span className="text-neutral-500 dark:text-neutral-300 text-sm font-normal">Approved:
                            <span className="text-neutral-600 dark:text-neutral-200 font-bold"> {approved.toLocaleString()}</span>
                        </span>
                    </li>
                    <li className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-xs bg-yellow-500"></span>
                        <span className="text-neutral-500 dark:text-neutral-300 text-sm font-normal">Pending:
                            <span className="text-neutral-600 dark:text-neutral-200 font-bold"> {pending.toLocaleString()}</span>
                        </span>
                    </li>
                </ul>

            </CardContent>
        </Card>
    );
};

export default CustomersStatisticsCard;

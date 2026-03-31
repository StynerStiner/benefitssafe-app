"use client";

import { useState, useMemo } from "react";
import StatsCard from "@/app/(dashboard)/(homes)/expenses/component/stats-card";
import GenerateContentChart from "@/components/charts/generate-content-chart";
import CustomSelect from "@/components/shared/custom-select";
import { Card, CardContent } from "@/components/ui/card";

interface Expense {
    amount: string;
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

const RevenueReportCard = ({ expenses }: { expenses: Expense[] }) => {
    const [period, setPeriod] = useState("Yearly");

    const filtered = useMemo(
        () => filterByPeriod(expenses, period) as Expense[],
        [expenses, period]
    );

    const totalRequested = filtered.reduce((sum, e) => sum + parseFloat(e.amount || "0"), 0);
    const approvedTotal = filtered
        .filter((e) => e.status === "APPROVED" || e.status === "PAID")
        .reduce((sum, e) => sum + parseFloat(e.amount || "0"), 0);

    return (
        <Card className="card rounded-lg border-0 !p-0">
            <CardContent className='p-0'>
                <div className="grid grid-cols-1 2xl:grid-cols-12">
                    <div className="xl:col-span-12 2xl:col-span-6">
                        <div className="card-body p-6">
                            <div className="flex items-center flex-wrap gap-2 justify-between">
                                <h6 className="mb-0 font-bold text-lg">Expense Trends</h6>
                                <CustomSelect
                                    placeholder="Yearly"
                                    value={period}
                                    onValueChange={setPeriod}
                                    options={["Yearly", "Monthly", "Weekly", "Today"]}
                                />
                            </div>
                            <ul className="flex flex-wrap items-center mt-4 gap-3">
                                <li className="flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-xs bg-blue-500"></span>
                                    <span className="text-neutral-500 dark:text-neutral-300 text-sm font-semibold">Requested:
                                        <span className="text-neutral-600 dark:text-neutral-200 font-bold"> ${totalRequested.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
                                    </span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-xs bg-yellow-500"></span>
                                    <span className="text-neutral-500 dark:text-neutral-300 text-sm font-semibold">Approved:
                                        <span className="text-neutral-600 dark:text-neutral-200 font-bold"> ${approvedTotal.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
                                    </span>
                                </li>
                            </ul>
                            <div className="mt-[60px]">
                                <div className="-m-4">
                                    <GenerateContentChart />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="xl:col-span-12 2xl:col-span-6 2xl:border-l border-neutral-200 dark:border-neutral-600">
                        <div className="grid grid-cols-1 sm:grid-cols-2 border-s-neutral-300">
                            <StatsCard expenses={filtered} />
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default RevenueReportCard;

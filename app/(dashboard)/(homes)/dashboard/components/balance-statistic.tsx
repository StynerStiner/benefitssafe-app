"use client";

import { useState } from "react";
import GenerateContentChart from '@/components/charts/generate-content-chart';
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

const BalanceStatistic = ({ expenses }: { expenses: Expense[] }) => {
    const [period, setPeriod] = useState("Yearly");

    const filtered = filterByPeriod(expenses, period) as Expense[];

    const approved = filtered.filter((e) => e.status === "APPROVED" || e.status === "PAID");
    const totalApproved = approved.reduce((sum, e) => sum + parseFloat(e.amount || "0"), 0);
    const pending = filtered.filter((e) => e.status === "PENDING");
    const totalPending = pending.reduce((sum, e) => sum + parseFloat(e.amount || "0"), 0);

    return (
        <Card className="card">
            <CardContent className="px-0">
                <div className="flex flex-wrap items-center justify-between">
                    <h6 className="text-lg mb-0">Monthly Disbursements</h6>
                    <CustomSelect
                        placeholder="Yearly"
                        options={["Yearly", "Monthly", "Weekly", "Today"]}
                        value={period}
                        onValueChange={setPeriod}
                    />
                </div>
                <ul className="flex flex-wrap items-center justify-center mt-4 gap-3">
                    <li className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                        <span className="text-neutral-500 dark:text-neutral-300 text-sm font-semibold">Approved:
                            <span className="text-neutral-600 dark:text-neutral-300 font-bold"> ${totalApproved.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
                        </span>
                    </li>
                    <li className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                        <span className="text-neutral-500 dark:text-neutral-300 text-sm font-semibold">Pending:
                            <span className="text-neutral-600 dark:text-neutral-300 font-bold"> ${totalPending.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
                        </span>
                    </li>
                </ul>

                <div className="mt-4">
                    <GenerateContentChart />
                </div>
            </CardContent>
        </Card>
    );
};

export default BalanceStatistic;

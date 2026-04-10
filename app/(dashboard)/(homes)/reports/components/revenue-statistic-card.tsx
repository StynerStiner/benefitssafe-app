"use client";

import RevenueStatisticAreaChart from "@/components/charts/revenue-statistic-area-chart";
import CustomSelect from "@/components/shared/custom-select";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useState, useMemo } from "react";

interface Grant { totalAmount: string; spentAmount: string; createdAt: string; }
interface Expense { amount: string; status: string; createdAt: string; }

function filterByPeriod<T extends { createdAt: string }>(items: T[], period: string): T[] {
    const now = new Date();
    return items.filter(item => {
        const date = new Date(item.createdAt);
        switch (period) {
            case "Weekly": return now.getTime() - date.getTime() < 7 * 24 * 60 * 60 * 1000;
            case "Monthly": return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
            case "Yearly": return date.getFullYear() === now.getFullYear();
            default: return true;
        }
    });
}

const RevenueStatisticCard = ({ grants, expenses }: { grants?: Grant[]; expenses?: Expense[] }) => {
    const [period, setPeriod] = useState("Monthly");

    const grantList = useMemo(() => filterByPeriod(grants || [], period), [grants, period]);
    const expenseList = useMemo(() => filterByPeriod(expenses || [], period), [expenses, period]);

    const totalAllocated = grantList.reduce((sum, g) => sum + parseFloat(g.totalAmount || "0"), 0);
    const totalSpent = grantList.reduce((sum, g) => sum + parseFloat(g.spentAmount || "0"), 0);
    const pendingAmount = expenseList.filter((e) => e.status === "PENDING")
        .reduce((sum, e) => sum + parseFloat(e.amount || "0"), 0);

    return (
        <Card className="card h-full rounded-lg border-0 !p-0 block">
            <CardContent className="card-body p-6 h-full flex flex-col justify-between">

                <div className="flex items-center flex-wrap gap-2 justify-between">
                    <h3 className="font-bold text-lg mb-0">Spending Trends</h3>
                    <CustomSelect
                        placeholder="Monthly"
                        options={["Monthly", "Weekly", "Yearly"]}
                        value={period}
                        onValueChange={setPeriod}
                    />
                </div>

                <ul className="flex flex-wrap items-center justify-center my-3 gap-6">
                    <li className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <span className="w-[8px] h-[8px] rounded-[50rem] bg-blue-500"></span>
                            <span className="text-neutral-600 text-sm dark:text-neutral-100 font-semibold">Allocated</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <h6 className="mb-0">${totalAllocated.toLocaleString("en-US", { maximumFractionDigits: 0 })}</h6>
                            <span className="text-green-500 flex items-center gap-1 text-sm font-bolder">
                                <ArrowUp width={12} />
                            </span>
                        </div>
                    </li>
                    <li className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <span className="w-[8px] h-[8px] rounded-[50rem] bg-purple-600"></span>
                            <span className="text-neutral-600 text-sm dark:text-neutral-100 font-semibold">Pending</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <h6 className="mb-0">${pendingAmount.toLocaleString("en-US", { maximumFractionDigits: 0 })}</h6>
                            <span className="text-red-600 flex items-center gap-1 text-sm font-bolder">
                                <ArrowDown width={12} />
                            </span>
                        </div>
                    </li>
                </ul>

                <div className="-m-4">
                    <RevenueStatisticAreaChart
                        series={[
                            { name: "Allocated", data: [6, 20, 15, 48, 28, 55, 28, 52, 25, 32, 15, 25] },
                            { name: "Spent", data: [0, 8, 4, 36, 16, 42, 16, 40, 12, 24, 4, 12] },
                        ]}
                        color1="#CD20F9"
                        color2="#6593FF"
                        height={200}
                    />
                </div>

            </CardContent>
        </Card>
    );
};

export default RevenueStatisticCard;

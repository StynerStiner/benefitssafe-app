"use client";

import AverageDailySalesChart from "@/components/charts/average-daily-sales-chart";
import CustomSelect from "@/components/shared/custom-select";
import { Card, CardContent } from "@/components/ui/card";
import { useState, useMemo } from "react";

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

const AverageDailySalesCard = ({ expenses }: { expenses?: Expense[] }) => {
    const [period, setPeriod] = useState("Monthly");

    const filtered = useMemo(() => filterByPeriod(expenses || [], period), [expenses, period]);

    const avgDaily = useMemo(() => {
        const now = new Date();
        const total = filtered.reduce((sum, e) => sum + parseFloat(e.amount || "0"), 0);

        if (period === "Weekly") {
            const days = Math.min(7, filtered.length > 0 ? 7 : 1);
            return total / days;
        } else if (period === "Yearly") {
            const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / (24 * 60 * 60 * 1000));
            return dayOfYear > 0 ? total / dayOfYear : 0;
        } else {
            // Monthly
            const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
            const currentDay = Math.min(now.getDate(), daysInMonth);
            return currentDay > 0 ? total / currentDay : 0;
        }
    }, [filtered, period]);

    return (
        <Card className="card h-full rounded-lg border-0 !p-0 block">
            <CardContent className="card-body p-6 h-full flex flex-col justify-between">
                <div className="flex items-center flex-wrap gap-2 justify-between">
                    <h3 className="font-bold text-lg mb-0">Average Daily Spending</h3>
                    <CustomSelect
                        placeholder="Monthly"
                        options={["Monthly", "Weekly", "Yearly"]}
                        value={period}
                        onValueChange={setPeriod}
                    />
                </div>

                <h6 className="text-center my-4">${avgDaily.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h6>

                <AverageDailySalesChart />

            </CardContent>
        </Card>
    );
};

export default AverageDailySalesCard;

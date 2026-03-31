"use client";

import DoubleLineChartTwo from "@/components/charts/double-line-chart-two";
import CustomSelect from "@/components/shared/custom-select";
import { Card, CardContent } from '@/components/ui/card';
import { useMemo, useState } from 'react';

interface Grant {
    totalAmount: string;
    spentAmount: string;
    createdAt: string;
}

function filterByPeriod(items: any[], period: string) {
    const now = new Date();
    return items.filter(item => {
        const date = new Date(item.createdAt);
        switch (period) {
            case "Today": return date.toDateString() === now.toDateString();
            case "Weekly": { const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7); return date >= weekAgo; }
            case "Monthly": { const monthAgo = new Date(now); monthAgo.setMonth(now.getMonth() - 1); return date >= monthAgo; }
            case "Yearly": default: { const yearAgo = new Date(now); yearAgo.setFullYear(now.getFullYear() - 1); return date >= yearAgo; }
        }
    });
}

const AverageEarningCard = ({ grants }: { grants: Grant[] }) => {
    const [period, setPeriod] = useState("Yearly");

    const filteredGrants = useMemo(() => filterByPeriod(grants, period) as Grant[], [grants, period]);

    const totalAllocated = useMemo(() => filteredGrants.reduce((sum, g) => sum + parseFloat(g.totalAmount || "0"), 0), [filteredGrants]);
    const totalDisbursed = useMemo(() => filteredGrants.reduce((sum, g) => sum + parseFloat(g.spentAmount || "0"), 0), [filteredGrants]);

    return (
        <>
            <Card className="card !p-0 border-0 rounded-xl shadow-none">
                <CardContent className="p-0">
                    <div className="border-b border-neutral-200 dark:border-slate-500 py-4 px-6 flex items-center justify-between flex-wrap gap-2">
                        <h6 className="font-semibold text-lg mb-0 text-foreground">Average Disbursements</h6>
                        <CustomSelect
                            placeholder="Yearly"
                            options={["Yearly", "Monthly", "Weekly", "Today"]}
                            value={period}
                            onValueChange={setPeriod}
                        />
                    </div>

                    <div className="card-body p-6">
                        <ul className="flex flex-wrap items-center justify-center my-3 gap-3">
                            <li className="flex items-center gap-2">
                                <span className="w-[12px] h-[8px] rounded-[50rem] bg-blue-600"></span>
                                <span className="text-neutral-500 dark:text-neutral-300 text-sm font-semibold">Allocated:
                                    <span className="text-[#0a0a0a] dark:text-white text-xl font-bold leading-1"> ${totalAllocated.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
                                </span>
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="w-[12px] h-[8px] rounded-[50rem] bg-yellow-500"></span>
                                <span className="text-neutral-500 dark:text-neutral-300 text-sm font-semibold">Disbursed:
                                    <span className="text-[#0a0a0a] dark:text-white text-xl font-bold leading-1"> ${totalDisbursed.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
                                </span>
                            </li>
                        </ul>
                        <DoubleLineChartTwo colors={["#487FFF", "#FF9F29"]} chartHeight="270" />
                    </div>
                </CardContent>
            </Card>
        </>
    );
};

export default AverageEarningCard;

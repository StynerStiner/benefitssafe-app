"use client";

import ClientPaymentStatusChart from "@/components/charts/client-payment-status-chart";
import { Card, CardContent } from '@/components/ui/card';
import { useMemo } from 'react';

interface Grant {
    createdAt: string;
    status: string;
    totalAmount: string;
    spentAmount: string;
    remainingAmount: string;
}

function filterByMonth(items: Grant[], month: number, year: number) {
    return items.filter(item => {
        const date = new Date(item.createdAt);
        return date.getMonth() === month && date.getFullYear() === year;
    });
}

const ProjectAnalysisCard = ({ grants, selectedMonth, selectedYear }: { grants: Grant[]; selectedMonth: number; selectedYear: number }) => {
    const filteredGrants = useMemo(() => filterByMonth(grants, selectedMonth, selectedYear), [grants, selectedMonth, selectedYear]);

    const summary = useMemo(() => ({
        allocated: filteredGrants.reduce((sum, g) => sum + parseFloat(g.totalAmount || "0"), 0),
        remaining: filteredGrants.reduce((sum, g) => sum + parseFloat(g.remainingAmount || "0"), 0),
        disbursed: filteredGrants.reduce((sum, g) => sum + parseFloat(g.spentAmount || "0"), 0),
        count: filteredGrants.length,
    }), [filteredGrants]);

    return (
        <Card className="card !p-0 border-0 rounded-xl shadow-none">
            <CardContent className="p-0">
                <div className="border-b border-neutral-200 dark:border-slate-500 py-4 px-6 flex items-center justify-between flex-wrap gap-2">
                    <h6 className="font-semibold text-lg mb-0 text-foreground">Grant Analysis</h6>
                </div>
                <div className="card-body p-6">
                    <ul className="flex flex-wrap items-center justify-center gap-6">
                        <li className="flex items-center gap-2">
                            <span className="w-[12px] h-[12px] rounded-[50%] bg-green-500"></span>
                            <span className="text-neutral-500 dark:text-neutral-300 text-sm font-medium">Allocated: ${summary.allocated.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="w-[12px] h-[12px] rounded-[50%] bg-blue-500"></span>
                            <span className="text-neutral-500 dark:text-neutral-300 text-sm font-medium">Remaining: ${summary.remaining.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="w-[12px] h-[12px] rounded-[50%] bg-yellow-500"></span>
                            <span className="text-neutral-500 dark:text-neutral-300 text-sm font-medium">Disbursed: ${summary.disbursed.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
                        </li>
                    </ul>
                    <p className="text-xs text-neutral-400 text-center mt-2">{summary.count} grant{summary.count !== 1 ? "s" : ""} in period</p>
                    <div className="mt-10">
                        <ClientPaymentStatusChart />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default ProjectAnalysisCard;

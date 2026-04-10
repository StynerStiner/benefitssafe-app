"use client";

import EarningStatisticsChart from '@/components/charts/earning-statistics-chart';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowBigUp, ShoppingCart, SquareKanban } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

function filterByMonth(items: { createdAt?: string }[], month: number, year: number) {
    return items.filter(item => {
        if (!item.createdAt) return false;
        const date = new Date(item.createdAt);
        return date.getMonth() === month && date.getFullYear() === year;
    });
}

interface Beneficiary {
    id: string;
    createdAt?: string;
    _count?: { grantsAsBeneficiary?: number; expenseRequests?: number };
}

const EarningStatisticsCard = ({ beneficiaries, selectedMonth, selectedYear }: { beneficiaries: Beneficiary[]; selectedMonth: number; selectedYear: number }) => {
    const [grants, setGrants] = useState<{ totalAmount: string; spentAmount: string; remainingAmount: string; createdAt?: string }[]>([]);

    useEffect(() => {
        fetch("/api/grants?limit=100")
            .then((r) => r.ok ? r.json() : { data: [] })
            .then((json) => {
                const items = Array.isArray(json) ? json : json.data;
                if (Array.isArray(items)) setGrants(items);
            })
            .catch(() => {});
    }, []);

    const filteredGrants = useMemo(() => filterByMonth(grants, selectedMonth, selectedYear) as typeof grants, [grants, selectedMonth, selectedYear]);

    const totals = useMemo(() => {
        const totalAllocated = filteredGrants.reduce((sum, g) => sum + parseFloat(g.totalAmount || "0"), 0);
        const totalSpent = filteredGrants.reduce((sum, g) => sum + parseFloat(g.spentAmount || "0"), 0);
        const totalRemaining = filteredGrants.reduce((sum, g) => sum + parseFloat(g.remainingAmount || "0"), 0);
        return { totalAllocated, totalSpent, totalRemaining };
    }, [filteredGrants]);

    const formatAmount = (amount: number) => {
        if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
        if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}k`;
        return `$${amount.toFixed(0)}`;
    };

    return (
        <Card className="card h-full rounded-lg border-0">
            <CardContent className="card-body p-0">
                <div className="flex items-center flex-wrap gap-2 justify-between">
                    <div>
                        <h3 className="mb-0 font-bold text-lg">Beneficiary Trends</h3>
                        <span className="text-sm font-medium text-neutral-600 dark:text-neutral-100">Enrollment overview</span>
                    </div>
                </div>

                <div className="mt-5 flex justify-center flex-wrap gap-3">

                    <div className="inline-flex items-center gap-2 p-2 rounded-lg border transition hover:border-primary border-neutral-200 dark:border-neutral-500 dark:hover:border-primary pe-[46px] br-hover-primary group">
                        <span className="bg-neutral-100 dark:bg-slate-600 w-[44px] h-[44px] text-2xl transition rounded-lg flex justify-center items-center text-neutral-600 dark:text-neutral-100 group-hover:text-white group-hover:bg-primary">
                            <ShoppingCart />
                        </span>
                        <div>
                            <span className="text-neutral-600 dark:text-neutral-100 text-sm font-medium">Grants</span>
                            <h6 className="text-base font-semibold mb-0">{formatAmount(totals.totalAllocated)}</h6>
                        </div>
                    </div>

                    <div className="inline-flex items-center gap-2 p-2 rounded-lg border transition hover:border-primary border-neutral-200 dark:border-neutral-500 dark:hover:border-primary pe-[46px] br-hover-primary group">
                        <span className="bg-neutral-100 dark:bg-slate-600 w-[44px] h-[44px] text-2xl transition rounded-lg flex justify-center items-center text-neutral-600 dark:text-neutral-100 group-hover:text-white group-hover:bg-primary">
                            <SquareKanban />
                        </span>
                        <div>
                            <span className="text-neutral-600 dark:text-neutral-100 text-sm font-medium">Expenses</span>
                            <h6 className="text-base font-semibold mb-0">{formatAmount(totals.totalSpent)}</h6>
                        </div>
                    </div>

                    <div className="inline-flex items-center gap-2 p-2 rounded-lg border transition hover:border-primary border-neutral-200 dark:border-neutral-500 dark:hover:border-primary pe-[46px] br-hover-primary group">
                        <span className="bg-neutral-100 dark:bg-slate-600 w-[44px] h-[44px] text-2xl transition rounded-lg flex justify-center items-center text-neutral-600 dark:text-neutral-100 group-hover:text-white group-hover:bg-primary">
                            <ArrowBigUp />
                        </span>
                        <div>
                            <span className="text-neutral-600 dark:text-neutral-100 text-sm font-medium">Remaining</span>
                            <h6 className="text-base font-semibold mb-0">{formatAmount(totals.totalRemaining)}</h6>
                        </div>
                    </div>
                </div>

                <EarningStatisticsChart/>
            </CardContent>
        </Card>
    );
};

export default EarningStatisticsCard;

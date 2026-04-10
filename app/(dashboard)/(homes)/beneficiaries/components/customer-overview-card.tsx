"use client";

import CustomerOverviewChart from '@/components/charts/customer-overview-chart';
import { Card, CardContent } from '@/components/ui/card';
import { useMemo } from 'react';

function filterByMonth(items: Beneficiary[], month: number, year: number) {
  return items.filter(item => {
    const date = new Date(item.createdAt);
    return date.getMonth() === month && date.getFullYear() === year;
  });
}

interface Beneficiary {
  createdAt: string;
  benefitPrograms: Record<string, boolean> | null;
  isActive: boolean;
}

const CustomerOverviewCard = ({ beneficiaries, selectedMonth, selectedYear }: { beneficiaries: Beneficiary[]; selectedMonth: number; selectedYear: number }) => {
    const filtered = useMemo(() => filterByMonth(beneficiaries, selectedMonth, selectedYear), [beneficiaries, selectedMonth, selectedYear]);

    const total = filtered.length;
    const active = filtered.filter((b) => b.isActive).length;
    const onSSI = filtered.filter((b) => b.benefitPrograms?.ssi).length;

    return (
        <Card className="card h-full rounded-lg border-0 overflow-hidden">
            <CardContent className="card-body p-0">
                <div className="flex items-center flex-wrap gap-2 justify-between">
                    <h3 className="mb-0 font-bold text-lg">Benefit Programs Overview</h3>
                </div>

                <div className="flex sm:flex-nowrap flex-wrap items-center mt-4">
                    <ul className="shrink-0">
                        <li className="flex items-center gap-2 mb-7">
                            <span className="w-3 h-3 rounded-full bg-green-600"></span>
                            <span className="text-neutral-500 dark:text-neutral-300 text-sm font-medium">Total: {total}</span>
                        </li>
                        <li className="flex items-center gap-2 mb-7">
                            <span className="w-3 h-3 rounded-full bg-orange-500"></span>
                            <span className="text-neutral-500 dark:text-neutral-300 text-sm font-medium">SSI: {onSSI}</span>
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                            <span className="text-neutral-500 dark:text-neutral-300 text-sm font-medium">Active: {active}</span>
                        </li>
                    </ul>
                    <div className="grow apexcharts-tooltip-z-none title-style circle-none donutChart">
                        <CustomerOverviewChart />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default CustomerOverviewCard;

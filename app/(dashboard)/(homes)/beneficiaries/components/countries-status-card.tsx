"use client";

import WorldMapChart from '@/components/charts/world-map-chart';
import CountryList from '@/components/shared/country-list';
import MonthYearPicker from '@/components/shared/month-year-picker';
import { Card, CardContent } from '@/components/ui/card';
import { useState, useMemo } from 'react';

function filterByMonth(items: any[], month: number, year: number) {
    return items.filter(item => {
        const date = new Date(item.createdAt);
        return date.getMonth() === month && date.getFullYear() === year;
    });
}

interface Beneficiary {
    createdAt: string;
    addressState?: string | null;
}

const CountriesStatusCard = ({ beneficiaries }: { beneficiaries: Beneficiary[] }) => {
    const now = new Date();
    const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());

    const filtered = useMemo(() => filterByMonth(beneficiaries, selectedMonth, selectedYear), [beneficiaries, selectedMonth, selectedYear]);

    const stateData = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const b of filtered) {
            const state = b.addressState || "Unknown";
            counts[state] = (counts[state] || 0) + 1;
        }
        return Object.entries(counts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);
    }, [filtered]);

    return (
        <Card className="card h-full rounded-lg border-0 !p-0">
            <CardContent className="card-body p-0">
                <div className="flex items-center flex-wrap gap-2 justify-between p-6">
                    <h6 className="mb-0 font-bold text-lg">Beneficiary Locations</h6>
                    <MonthYearPicker
                        selectedMonth={selectedMonth}
                        selectedYear={selectedYear}
                        onChange={(month, year) => {
                            setSelectedMonth(month);
                            setSelectedYear(year);
                        }}
                    />
                </div>

                <div className="bg-neutral-100 dark:bg-slate-700/50 h-[200px] overflow-hidden">
                  <WorldMapChart mapHeight={400} />
                </div>

                <div className="max-h-[266px] overflow-y-auto p-6 scrollbar-thin scrollbar-invisible hover:scrollbar-visible">
                  <CountryList data={stateData} />
                </div>
            </CardContent>
        </Card>
    );
};

export default CountriesStatusCard;

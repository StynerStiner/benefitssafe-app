"use client";

import WorldMapChart from '@/components/charts/world-map-chart';
import CountryList from '@/components/shared/country-list';
import CustomSelect from '@/components/shared/custom-select';
import { Card, CardContent } from '@/components/ui/card';
import { useState, useMemo } from 'react';

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

interface Beneficiary {
    createdAt: string;
    addressState?: string | null;
}

const CountriesStatusCard = ({ beneficiaries }: { beneficiaries: Beneficiary[] }) => {
    const [selectedPeriod, setSelectedPeriod] = useState("Yearly");

    const filtered = useMemo(() => filterByPeriod(beneficiaries, selectedPeriod), [beneficiaries, selectedPeriod]);

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
                    <CustomSelect
                      placeholder="Yearly"
                      options={["Yearly", "Monthly", "Weekly", "Today"]}
                      value={selectedPeriod}
                      onValueChange={setSelectedPeriod}
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

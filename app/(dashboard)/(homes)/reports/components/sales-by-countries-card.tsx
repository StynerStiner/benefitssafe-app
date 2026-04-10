"use client";

import WorldMapChart from "@/components/charts/world-map-chart";
import CountryList from "@/components/shared/country-list";
import CustomSelect from "@/components/shared/custom-select";
import { Card, CardContent } from "@/components/ui/card";
import { useState, useMemo } from "react";

interface Grant {
    name: string;
    totalAmount: string;
    spentAmount: string;
    status: string;
    createdAt: string;
}

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

const SalesByCountriesCard = ({ grants }: { grants?: Grant[] }) => {
    const [period, setPeriod] = useState("Monthly");

    const filtered = useMemo(() => filterByPeriod(grants || [], period), [grants, period]);

    const grantData = useMemo(() => {
        if (filtered.length === 0) return [];
        return filtered
            .map((g) => ({
                name: g.name,
                count: Math.round(parseFloat(g.spentAmount) || 0),
            }))
            .sort((a, b) => b.count - a.count);
    }, [filtered]);

    return (
        <Card className="card h-full rounded-lg border-0 !p-0 block">
            <CardContent className="card-body p-6 h-full flex flex-col justify-between">

                <div className="flex items-center flex-wrap gap-2 justify-between mb-5">
                    <h3 className="font-bold text-lg mb-0">Spending by Grant</h3>
                    <CustomSelect
                        placeholder="Monthly"
                        options={["Monthly", "Weekly", "Yearly",]}
                        value={period}
                        onValueChange={setPeriod}
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="col-span-12 lg:col-span-6">
                        <div className="border border-neutral-300 dark:border-neutral-300/20 rounded-lg bg-neutral-50 dark:bg-neutral-600/20 h-full">
                            <WorldMapChart mapHeight={266} />
                        </div>
                    </div>
                    <div className="col-span-12 lg:col-span-6">
                        <div className="border border-neutral-300 dark:border-neutral-300/20 rounded-lg bg-neutral-50 dark:bg-neutral-600/20 h-full max-h-[266px] overflow-y-auto p-6 scrollbar-thin scrollbar-invisible hover:scrollbar-visible">
                            <CountryList data={grantData} />
                        </div>
                    </div>
                </div>

            </CardContent>
        </Card>
    );
};

export default SalesByCountriesCard;
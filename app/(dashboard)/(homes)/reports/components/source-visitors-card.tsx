"use client";

import CustomSelect from "@/components/shared/custom-select";
import { Card, CardContent } from "@/components/ui/card";
import { useState, useMemo } from "react";

interface Expense {
    riskClassification: string | null;
    status: string;
    createdAt: string;
}

interface RiskCategory {
    id: number;
    title: string;
    percentage: number;
    bgColor: string;
    iconBg: string;
}

const riskMeta: { key: string; title: string; bgColor: string; iconBg: string }[] = [
    { key: "LIKELY_SAFE", title: "Likely Safe", bgColor: "from-[#86dd6640] to-[#028c4b40]", iconBg: "bg-green-600" },
    { key: "NEEDS_REVIEW", title: "Needs Review", bgColor: "from-[#ffba4540] to-[#f4743540]", iconBg: "bg-yellow-600" },
    { key: "LIKELY_RISKY", title: "Likely Risky", bgColor: "from-[#fc788a40] to-[#98168b40]", iconBg: "bg-violet-600" },
    { key: "BLOCKED", title: "Blocked", bgColor: "from-[#19cfef40] to-[#0d6ab840]", iconBg: "bg-primary" },
];

function filterByPeriod<T extends { createdAt: string }>(items: T[], period: string): T[] {
    const now = new Date();
    return items.filter(item => {
        const date = new Date(item.createdAt);
        switch (period) {
            case "Last Weekly": return now.getTime() - date.getTime() < 7 * 24 * 60 * 60 * 1000;
            case "Last Month": {
                const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                return date.getMonth() === lastMonth.getMonth() && date.getFullYear() === lastMonth.getFullYear();
            }
            case "Last Yearly": return date.getFullYear() === now.getFullYear() - 1;
            default: return true;
        }
    });
}

const SourceVisitorsCard = ({ expenses }: { expenses?: Expense[] }) => {
    const [period, setPeriod] = useState("Last Month");

    const filtered = useMemo(() => filterByPeriod(expenses || [], period), [expenses, period]);

    const categories: RiskCategory[] = useMemo(() => {
        const all = filtered;
        const total = all.length || 1;
        return riskMeta.map((meta, i) => {
            const count = all.filter((e) => e.riskClassification === meta.key).length;
            return {
                id: i + 1,
                title: meta.title,
                percentage: Math.round((count / total) * 100),
                bgColor: meta.bgColor,
                iconBg: meta.iconBg,
            };
        });
    }, [filtered]);

    const totalExpenses = filtered.length;

    return (
        <Card className="card h-full rounded-lg border-0 !p-0 block">
            <CardContent className="card-body p-6 h-full flex flex-col justify-between">
                <div className="flex items-center flex-wrap gap-2 justify-between mb-5">
                    <h6 className="font-bold text-lg mb-0">Expense Risk Breakdown</h6>
                    <CustomSelect
                        placeholder="Last Month"
                        options={["Last Month", "Last Weekly", "Last Yearly"]}
                        value={period}
                        onValueChange={setPeriod}
                    />
                </div>

                {/* Chart Bars */}
                <div className="relative h-full min-h-[280px]">
                    <div className="md:absolute start-0 top-0 mt-5">
                        <h6 className="mb-1">{totalExpenses.toLocaleString()}</h6>
                        <span className="text-neutral-600 dark:text-neutral-200">
                            Total Expenses
                        </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 min-h-[inherit]">
                        {categories.map((src) => (
                            <div
                                key={src.id}
                                className="col-span-12 md:col-span-3 sm:col-span-6 flex flex-col justify-end"
                            >
                                <div
                                    className={`flex flex-col items-center p-6 pt-4 rounded-t-xl bg-gradient-to-b ${src.bgColor}`}
                                    style={{ minHeight: `${src.percentage || 10}%` }}
                                >
                                    <span
                                        className={`w-[40px] h-[40px] flex shrink-0 justify-center items-center ${src.iconBg} rounded-full mb-3`}
                                    >
                                    </span>
                                    <span className="text-neutral-600 dark:text-neutral-200">
                                        {src.title}
                                    </span>
                                    <h6 className="mb-0">{src.percentage}%</h6>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default SourceVisitorsCard;

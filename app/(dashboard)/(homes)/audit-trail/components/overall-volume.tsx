"use client";

import DoubleLineChart from "@/components/charts/double-line-chart";
import CustomSelect from "@/components/shared/custom-select";
import { Card, CardContent } from '@/components/ui/card';
import { useState, useMemo } from "react";

interface AuditLog {
    id: string;
    userId: string;
    action: string;
    entityType: string;
    entityId: string;
    createdAt: string;
    newValue: Record<string, unknown> | null;
}

function filterByPeriod<T extends { createdAt: string }>(items: T[], period: string): T[] {
    const now = new Date();
    return items.filter(item => {
        const date = new Date(item.createdAt);
        switch (period) {
            case "Today": return date.toDateString() === now.toDateString();
            case "Weekly": return now.getTime() - date.getTime() < 7 * 24 * 60 * 60 * 1000;
            case "Monthly": return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
            case "Yearly": return date.getFullYear() === now.getFullYear();
            default: return true;
        }
    });
}

const OverallVolume = ({ auditLogs }: { auditLogs: AuditLog[] }) => {
    const [period, setPeriod] = useState("Yearly");

    const filtered = useMemo(() => filterByPeriod(auditLogs, period), [auditLogs, period]);

    const { createCount, updateCount, deleteCount, chartSeries } = useMemo(() => {
        let creates = 0;
        let updates = 0;
        let deletes = 0;

        // Group by month for chart
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const createsByMonth = new Array(12).fill(0);
        const updatesByMonth = new Array(12).fill(0);

        filtered.forEach(log => {
            const action = log.action.toUpperCase();
            const month = new Date(log.createdAt).getMonth();

            if (action === 'CREATE') {
                creates++;
                createsByMonth[month]++;
            } else if (action === 'UPDATE') {
                updates++;
                updatesByMonth[month]++;
            } else if (action === 'DELETE') {
                deletes++;
            }
        });

        const series = [
            { name: "Creates", data: createsByMonth },
            { name: "Updates", data: updatesByMonth },
        ];

        return { createCount: creates, updateCount: updates, deleteCount: deletes, chartSeries: series };
    }, [filtered]);

    const formatCount = (n: number) => {
        if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
        return String(n);
    };

    return (
        <Card className="card !p-0 border-0 rounded-xl shadow-none">
            <CardContent className="p-0">
                <div className="border-b border-neutral-200 dark:border-slate-500 py-4 px-6 flex items-center justify-between flex-wrap gap-2">
                    <h6 className="font-semibold text-lg mb-0 text-foreground">Activity Volume</h6>
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
                            <span className="text-neutral-500 dark:text-neutral-200 text-sm">Creates
                                <span className="text-primary-light text-xl font-bold line-height-1 ms-1">{formatCount(createCount)}</span>
                            </span>
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="w-[12px] h-[8px] rounded-[50rem] bg-yellow-500"></span>
                            <span className="text-neutral-500 dark:text-neutral-200 text-sm">Updates
                                <span className="text-primary-light text-xl font-bold line-height-1 ms-1">{formatCount(updateCount)}</span>
                            </span>
                        </li>
                    </ul>
                    <DoubleLineChart colors={["#487FFF", "#FF9F29"]} series={chartSeries} />
                </div>
            </CardContent>
        </Card>
    );
};

export default OverallVolume;

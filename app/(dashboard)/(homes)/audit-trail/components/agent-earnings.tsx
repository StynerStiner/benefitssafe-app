"use client";

import AgentEarningsChart from "@/components/charts/agent-earnings-chart";
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

const AgentEarnings = ({ auditLogs }: { auditLogs: AuditLog[] }) => {
    const [period, setPeriod] = useState("Yearly");

    const filtered = useMemo(() => filterByPeriod(auditLogs, period), [auditLogs, period]);

    const { totalActions, chartSeries } = useMemo(() => {
        const total = filtered.length;

        // Group by day of week
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dayCounts: Record<string, number> = {};
        dayNames.forEach(d => { dayCounts[d] = 0; });

        filtered.forEach(log => {
            const date = new Date(log.createdAt);
            const day = dayNames[date.getDay()];
            dayCounts[day] = (dayCounts[day] || 0) + 1;
        });

        const series = [{
            name: "Actions",
            data: dayNames.map(d => ({ x: d, y: dayCounts[d] }))
        }];

        return { totalActions: total, chartSeries: series };
    }, [filtered]);

    return (
        <Card className="card !p-0 border-0 rounded-xl shadow-none">
            <CardContent className="p-0">
                <div className="border-b border-neutral-200 dark:border-slate-500 py-4 px-6 flex items-center justify-between flex-wrap gap-2">
                    <h3 className="font-semibold text-lg mb-0 text-foreground">User Activity</h3>
                    <CustomSelect
                        placeholder="Yearly"
                        options={["Yearly", "Monthly", "Weekly", "Today"]}
                        value={period}
                        onValueChange={setPeriod}
                    />
                </div>
                <div className="card-body p-6">
                    <div className="inline-flex items-center gap-3">
                        <span
                            className="bg-green-100 dark:bg-green-500/25 w-[48px] h-[48px] text-xxl rounded-circle flex justify-center items-center text-neutral-500 dark:text-neutral-200">
                            <img src="assets/images/home-sixteen/icon/dollar-bag.png" alt="Icon" />
                        </span>
                        <div>
                            <h6 className="font-semibold mb-0">{totalActions.toLocaleString()}</h6>
                            <span className="text-neutral-500 dark:text-neutral-200 mt-1">Total Actions</span>
                        </div>
                    </div>
                    <AgentEarningsChart series={chartSeries} />
                </div>
            </CardContent>
        </Card>
    );
};

export default AgentEarnings;

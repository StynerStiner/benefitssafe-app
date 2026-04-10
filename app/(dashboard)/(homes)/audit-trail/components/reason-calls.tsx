"use client";

import ReasonCallsChart from '@/components/charts/reason-calls-chart';
import { Card, CardContent } from "@/components/ui/card";
import { useMemo } from "react";

interface AuditLog {
    id: string;
    userId: string;
    action: string;
    entityType: string;
    entityId: string;
    createdAt: string;
    newValue: Record<string, unknown> | null;
}

const ReasonCalls = ({ auditLogs }: { auditLogs: AuditLog[] }) => {
    const { chartSeries, categories } = useMemo(() => {
        const counts: Record<string, number> = {};
        auditLogs.forEach(log => {
            const action = log.action.charAt(0).toUpperCase() + log.action.slice(1).toLowerCase();
            counts[action] = (counts[action] || 0) + 1;
        });

        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        const cats = sorted.map(([name]) => name);
        const data = sorted.map(([, count]) => count);

        return {
            categories: cats,
            chartSeries: [{ data }],
        };
    }, [auditLogs]);

    return (
        <Card className="card !p-0 border-0 rounded-xl shadow-none">
            <CardContent className="p-0">
                <div className="border-b border-neutral-200 dark:border-slate-500 py-4 px-6 flex items-center justify-between flex-wrap gap-2">
                    <h3 className="font-semibold text-lg mb-0 text-foreground">Action Types</h3>
                </div>
                <div className="card-body p-6">
                    <ReasonCallsChart
                        series={chartSeries.length > 0 && chartSeries[0].data.length > 0 ? chartSeries : undefined}
                        categories={categories.length > 0 ? categories : undefined}
                    />
                </div>
            </CardContent>
        </Card>
    );
};

export default ReasonCalls;

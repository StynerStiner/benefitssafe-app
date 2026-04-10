"use client";

import SemiCircleGaugeTwo from '@/components/charts/semi-circle-gauge-two';
import CustomSelect from '@/components/shared/custom-select';
import { Card, CardContent } from '@/components/ui/card';
import { Clock } from 'lucide-react';
import { useState, useMemo } from 'react';

interface AuditLogItem {
    id: string;
    userId: string;
    action: string;
    createdAt: string;
}

interface ResponseTimeCardProps {
    auditLogs: AuditLogItem[];
}

function filterLogsByPeriod(logs: AuditLogItem[], period: string): AuditLogItem[] {
    const now = new Date();
    return logs.filter(log => {
        const d = new Date(log.createdAt);
        switch (period) {
            case "Today":
                return d.toDateString() === now.toDateString();
            case "Weekly": {
                const weekAgo = new Date(now);
                weekAgo.setDate(weekAgo.getDate() - 7);
                return d >= weekAgo;
            }
            case "Monthly": {
                const monthAgo = new Date(now);
                monthAgo.setMonth(monthAgo.getMonth() - 1);
                return d >= monthAgo;
            }
            default:
                return true;
        }
    });
}

const ResponseTimeCard = ({ auditLogs }: ResponseTimeCardProps) => {
    const [period, setPeriod] = useState("Yearly");

    const filtered = useMemo(() => filterLogsByPeriod(auditLogs, period), [auditLogs, period]);

    // Calculate average time between consecutive audit log entries (response time proxy)
    const { totalHours, avgHrs, avgMins } = useMemo(() => {
        if (filtered.length < 2) {
            return { totalHours: 0, avgHrs: 0, avgMins: 0 };
        }
        const sorted = [...filtered].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        let totalDiffMs = 0;
        let count = 0;
        for (let i = 1; i < sorted.length; i++) {
            const diff = new Date(sorted[i].createdAt).getTime() - new Date(sorted[i - 1].createdAt).getTime();
            totalDiffMs += diff;
            count++;
        }
        const avgMs = count > 0 ? totalDiffMs / count : 0;
        const totalH = Math.round(totalDiffMs / (1000 * 60 * 60));
        const avgH = Math.floor(avgMs / (1000 * 60 * 60));
        const avgM = Math.round((avgMs % (1000 * 60 * 60)) / (1000 * 60));
        return { totalHours: totalH, avgHrs: avgH, avgMins: avgM };
    }, [filtered]);

    // Gauge value: percentage (lower avg response time = higher gauge)
    // Cap at 100 for the gauge
    const gaugeValue = totalHours > 0 ? Math.min(100, Math.round((1 / (avgHrs + 1)) * 100)) : 0;

    return (
        <Card className="card h-full rounded-lg border-0 !p-0">
            <CardContent className="card-body p-6">
                <div className="flex items-center flex-wrap gap-2 justify-between pb-6">
                    <h3 className="mb-0 font-bold text-lg">Response Time</h3>
                    <CustomSelect
                        placeholder="Yearly"
                        options={["Yearly", "Monthly", "Weekly", "Today"]}
                        onValueChange={(val: string) => setPeriod(val)}
                    />
                </div>

                <div className="text-center">
                    <div className="relative">
                        <div className="big-semi-circle-gauge flex justify-center">
                            <SemiCircleGaugeTwo value={gaugeValue} />
                        </div>
                        <span className="w-[90px] h-[90px] rounded-full bg-blue-100 dark:bg-blue-900 flex justify-center items-center absolute start-[50%] translate-x-[-50%] rtl:translate-x-[50%] top-[50%] text-blue-600">
                            <Clock className="w-[48px] h-[48px]" />
                        </span>
                    </div>
                    <h3 className="mt-10 mb-0 leading-none">{totalHours}h</h3>
                    <span className="text-neutral-800 dark:text-neutral-300 mt-4">{avgHrs} hrs : {avgMins} mins</span>
                </div>

            </CardContent>
        </Card>
    );
};

export default ResponseTimeCard;
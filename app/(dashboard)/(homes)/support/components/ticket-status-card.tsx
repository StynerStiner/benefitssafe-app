"use client";

import MultipleSeriesChartTwo from '@/components/charts/multiple-series-chart-two';
import CustomSelect from '@/components/shared/custom-select';
import { Card, CardContent } from '@/components/ui/card';
import { useState, useMemo } from 'react';

interface NotificationItem {
    id: string;
    type: string;
    read: boolean;
    createdAt: string;
}

interface TicketStatusCardProps {
    notifications: NotificationItem[];
}

function filterByPeriod(items: NotificationItem[], period: string): NotificationItem[] {
    const now = new Date();
    return items.filter(item => {
        const d = new Date(item.createdAt);
        switch (period) {
            case "Today": {
                return d.toDateString() === now.toDateString();
            }
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
                return true; // Yearly = all
        }
    });
}

const TicketStatusCard = ({ notifications }: TicketStatusCardProps) => {
    const [period, setPeriod] = useState("Yearly");

    const filtered = useMemo(() => filterByPeriod(notifications, period), [notifications, period]);

    const pending = filtered.filter(n => !n.read).length;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const hold = filtered.filter(n => !n.read && new Date(n.createdAt) < sevenDaysAgo).length;
    const complete = filtered.filter(n => n.read).length;
    const cancelled = 0;

    const chartSeries = [pending, hold, complete, cancelled];

    return (
        <Card className="card h-full rounded-lg border-0 !p-0">
            <CardContent className="card-body p-6">
                <div className="flex items-center flex-wrap gap-2 justify-between pb-6">
                    <h3 className="mb-0 font-bold text-lg">Ticket Status</h3>
                    <CustomSelect
                        placeholder="Yearly"
                        options={["Yearly", "Monthly", "Weekly", "Today"]}
                        onValueChange={(val: string) => setPeriod(val)}
                    />
                </div>

                <div className="p-4">
                    <MultipleSeriesChartTwo series={chartSeries} />
                    <div className="flex items-center gap-3 text-sm justify-center mt-6">
                        <span className="text-neutral-600 font-medium">Pending:
                            <span className="font-semibold text-yellow-600 dark:text-yellow-600 ps-1">{pending}</span>
                        </span>
                        <span className="text-neutral-600 font-medium">Hold:
                            <span className="font-semibold text-purple-600 dark:text-purple-600 ps-1">{hold}</span>
                        </span>
                        <span className="text-neutral-600 font-medium">Complete:
                            <span className="font-semibold text-green-600 dark:text-green-600 ps-1">{complete}</span>
                        </span>
                        <span className="text-neutral-600 font-medium">Cancelled:
                            <span className="font-semibold text-red-600 dark:text-red-600 ps-1">{cancelled}</span>
                        </span>
                    </div>
                </div>

            </CardContent>
        </Card>
    );
};

export default TicketStatusCard;
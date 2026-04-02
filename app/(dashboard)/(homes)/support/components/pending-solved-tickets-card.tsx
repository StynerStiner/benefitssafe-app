"use client";

import PendingSolvedTicketsChart from '@/components/charts/pending-solved-tickets-chart';
import CustomSelect from '@/components/shared/custom-select';
import { Card, CardContent } from '@/components/ui/card';
import { useState, useMemo } from 'react';

interface NotificationItem {
    id: string;
    read: boolean;
    createdAt: string;
}

interface PendingSolvedTicketsCardProps {
    notifications: NotificationItem[];
}

function filterByPeriod(items: NotificationItem[], period: string): NotificationItem[] {
    const now = new Date();
    return items.filter(item => {
        const d = new Date(item.createdAt);
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

function buildMonthlySeries(items: NotificationItem[]): number[] {
    const now = new Date();
    const series: number[] = [];
    for (let i = 8; i >= 0; i--) {
        const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
        const count = items.filter(n => {
            const d = new Date(n.createdAt);
            return d >= monthStart && d <= monthEnd;
        }).length;
        series.push(count);
    }
    return series;
}

const PendingSolvedTicketsCard = ({ notifications }: PendingSolvedTicketsCardProps) => {
    const [period, setPeriod] = useState("Yearly");

    const filtered = useMemo(() => filterByPeriod(notifications, period), [notifications, period]);

    const pendingCount = filtered.filter(n => !n.read).length;
    const solvedCount = filtered.filter(n => n.read).length;

    const pendingItems = filtered.filter(n => !n.read);
    const solvedItems = filtered.filter(n => n.read);

    const pendingSeries = buildMonthlySeries(pendingItems);
    const solvedSeries = buildMonthlySeries(solvedItems);

    return (
        <Card className="card h-full rounded-lg border-0 !p-0">
            <CardContent className="card-body p-6">
                <div className="flex items-center flex-wrap gap-2 justify-between pb-6">
                    <h6 className="mb-0 font-bold text-lg">Pending Vs Solved Tickets</h6>
                    <CustomSelect
                        placeholder="Yearly"
                        options={["Yearly", "Monthly", "Weekly", "Today"]}
                        onValueChange={(val: string) => setPeriod(val)}
                    />
                </div>

                <ul className="flex flex-wrap items-center justify-center mb-3 gap-3">
                    <li className="flex items-center gap-2">
                        <span className="w-[12px] h-[8px] rounded-[50rem] bg-yellow-500"></span>
                        <span className="text-neutral-600 dark:text-neutral-300 text-sm font-semibold">Pending
                            <span className="text-blue-light font-bold text-xl ms-1">{pendingCount}</span>
                        </span>
                    </li>
                    <li className="flex items-center gap-2">
                        <span className="w-[12px] h-[8px] rounded-[50rem] bg-green-600"></span>
                        <span className="text-neutral-600 dark:text-neutral-300 text-sm font-semibold">Solved
                            <span className="text-blue-light font-bold text-xl ms-1"> {solvedCount}</span>
                        </span>
                    </li>
                </ul>

                <PendingSolvedTicketsChart colors={["#f0b100", "#16a34a"]} pendingSeries={pendingSeries} solvedSeries={solvedSeries} />

            </CardContent>
        </Card>
    );
};

export default PendingSolvedTicketsCard;
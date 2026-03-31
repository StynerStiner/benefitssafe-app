"use client";

import CustomSelect from "@/components/shared/custom-select";
import { Card, CardContent } from '@/components/ui/card';
import { useMemo, useState } from 'react';

interface Grant {
    id: string;
    name: string;
    status: string;
    endDate: string | null;
    startDate: string;
    beneficiary: {
        firstName: string;
        lastName: string;
    } | null;
}

const WorkingScheduleCard = ({ grants }: { grants: Grant[] }) => {
    const months = useMemo(() => {
        const m = [];
        const now = new Date();
        for (let i = 0; i < 12; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
            m.push(d.toLocaleDateString("en-US", { month: "short", year: "numeric" }));
        }
        return m;
    }, []);

    const [selectedMonth, setSelectedMonth] = useState(months[0]);

    const selectedDate = useMemo(() => {
        const parts = selectedMonth.split(" ");
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const monthIndex = monthNames.indexOf(parts[0]);
        const year = parseInt(parts[1], 10);
        return new Date(year, monthIndex, 1);
    }, [selectedMonth]);

    const today = useMemo(() => new Date(), []);

    const weekDays = useMemo(() => {
        const days = [];
        const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

        const isCurrentMonth =
            selectedDate.getMonth() === today.getMonth() &&
            selectedDate.getFullYear() === today.getFullYear();

        const centerDay = isCurrentMonth ? today.getDate() : 15;
        const startOffset = -3;

        for (let i = startOffset; i <= 6; i++) {
            const d = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), centerDay + i);
            const isTodayDate =
                d.getDate() === today.getDate() &&
                d.getMonth() === today.getMonth() &&
                d.getFullYear() === today.getFullYear();
            days.push({
                label: dayNames[d.getDay()],
                date: d.getDate(),
                isToday: isTodayDate,
            });
        }
        return days;
    }, [selectedDate, today]);

    const upcomingGrants = useMemo(() => {
        const colors = ["border-purple", "border-yellow-600", "border-cyan-600", "border-green-600", "border-red-600"];
        return grants
            .filter((g) => {
                if (g.status !== "ACTIVE" && g.status !== "DRAFT") return false;
                const start = new Date(g.startDate);
                const end = g.endDate ? new Date(g.endDate) : null;
                const monthStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
                const monthEnd = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
                if (start > monthEnd) return false;
                if (end && end < monthStart) return false;
                return true;
            })
            .slice(0, 5)
            .map((g, i) => ({
                name: g.name,
                status: g.status,
                lead: g.beneficiary ? `${g.beneficiary.firstName} ${g.beneficiary.lastName}` : "Unassigned",
                endDate: g.endDate ? new Date(g.endDate).toLocaleDateString() : "No end date",
                color: colors[i % colors.length],
            }));
    }, [grants, selectedDate]);

    return (
        <Card className="card !p-0 border-0 rounded-xl shadow-none">
            <CardContent className="p-0">
                <div className="border-b border-neutral-200 dark:border-slate-500 py-4 px-6 flex items-center justify-between flex-wrap gap-2">
                    <h6 className="font-semibold text-lg mb-0 text-foreground">Grant Schedule</h6>
                    <CustomSelect
                        placeholder={months[0]}
                        options={months}
                        value={selectedMonth}
                        onValueChange={setSelectedMonth}
                    />
                </div>
                <div className="card-body p-6">
                    <div className="flex items-center gap-4 justify-between flex-wrap">
                        {weekDays.map((day, idx) => (
                            <div
                                key={idx}
                                className={`week-item text-center ${day.isToday ? "bg-purple-500 rounded-[50rem] py-3 px-4" : ""}`}
                            >
                                <span className={`text-sm font-medium ${day.isToday ? "text-white" : "text-neutral-400"}`}>
                                    {day.label}
                                </span>
                                <h6 className={`text-base mb-0 ${day.isToday ? "text-white" : ""}`}>
                                    {day.date}
                                </h6>
                            </div>
                        ))}
                    </div>

                    <div className="mt-6 flex flex-col gap-5">
                        {upcomingGrants.length === 0 && (
                            <p className="text-sm text-neutral-400 text-center py-4">No active grants scheduled</p>
                        )}
                        {upcomingGrants.map((grant, idx) => (
                            <div
                                key={idx}
                                className={`flex items-center justify-between gap-1 ps-2.5 border-inline-start border-start-width-[3px] ${grant.color}`}
                            >
                                <div>
                                    <div className="flex items-center gap-1">
                                        <h6 className="text-lg mb-0">{grant.name}</h6>
                                    </div>
                                    <p className="text-sm text-neutral-500 dark:text-neutral-300 font-medium mb-1">
                                        Status: {grant.status} | Ends: {grant.endDate}
                                    </p>
                                    <p className="text-xs text-neutral-400 font-medium mb-0">
                                        Beneficiary: <span className="text-green-600">{grant.lead}</span>
                                    </p>
                                </div>
                                <div>
                                    <span className="bg-neutral-200 dark:bg-neutral-600 text-sm text-[#0a0a0a] dark:text-white py-1.5 rounded px-6">
                                        {grant.status}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default WorkingScheduleCard;

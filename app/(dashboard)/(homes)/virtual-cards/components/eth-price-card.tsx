"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import UpDownSharpChart from "@/components/charts/up-down-sharp-chart";
import MonthYearPicker from "@/components/shared/month-year-picker";

interface VirtualCard {
    id: string;
    last4: string;
    spendingCap: string | null;
    spendingLimit?: string | number;
    cardType: string;
    status: string;
    createdAt: string;
    beneficiary?: {
        id: string;
        firstName: string;
        lastName: string;
        avatarUrl: string | null;
    } | null;
    vendor: { id: string; name: string; type: string } | null;
    expense: { id: string; description: string; amount: string } | null;
}

const EthPriceCard = ({ cards }: { cards: VirtualCard[] }) => {
    const now = useMemo(() => new Date(), []);
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());
    const [selectedMonthIndex, setSelectedMonthIndex] = useState(now.getMonth());

    const selectedMonth = useMemo(() => {
        return `${selectedYear}-${String(selectedMonthIndex + 1).padStart(2, "0")}`;
    }, [selectedYear, selectedMonthIndex]);

    const filteredCards = useMemo(() => {
        if (!selectedMonth) return cards;
        return cards.filter((card) => {
            const created = new Date(card.createdAt);
            const cardKey = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, "0")}`;
            return cardKey === selectedMonth;
        });
    }, [cards, selectedMonth]);

    const totalSpending = useMemo(() => {
        return filteredCards.reduce((sum, card) => {
            const cap = card.spendingCap ? parseFloat(card.spendingCap) : 0;
            const expense = card.expense ? parseFloat(card.expense.amount) : 0;
            return sum + (expense || cap);
        }, 0);
    }, [filteredCards]);

    return (
        <Card className="card h-full rounded-lg border-0 !p-0">
            <CardContent className="card-body p-0 flex flex-col justify-between gap-8">
                <div>
                    <div className="card-header border-b border-neutral-200 dark:border-slate-500 py-4 px-6">
                        <div className="flex items-center flex-wrap gap-2 justify-between">
                            <h6 className="font-bold text-lg mb-0">Card Spending</h6>
                            <MonthYearPicker
                                selectedMonth={selectedMonthIndex}
                                selectedYear={selectedYear}
                                onChange={(m, y) => { setSelectedMonthIndex(m); setSelectedYear(y); }}
                            />
                        </div>
                    </div>
                    <div className="card-body py-4 px-6">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <span className="text-sm text-neutral-500 dark:text-neutral-300">Cards this month</span>
                                <h6 className="font-bold text-lg mb-0">{filteredCards.length}</h6>
                            </div>
                            <div>
                                <span className="text-sm text-neutral-500 dark:text-neutral-300">Total spending</span>
                                <h6 className="font-bold text-lg mb-0">${totalSpending.toFixed(2)}</h6>
                            </div>
                        </div>
                        <div className="apexcharts-tooltip-style-1 yaxies-more label--20-px">
                            <UpDownSharpChart />
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default EthPriceCard;

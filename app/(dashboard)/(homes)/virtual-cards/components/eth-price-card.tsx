"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, ChevronRight } from "lucide-react";
import UpDownSharpChart from "@/components/charts/up-down-sharp-chart";

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

const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

const EthPriceCard = ({ cards }: { cards: VirtualCard[] }) => {
    const now = useMemo(() => new Date(), []);
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());
    const [selectedMonthIndex, setSelectedMonthIndex] = useState(now.getMonth());

    const goToPreviousMonth = () => {
        setSelectedMonthIndex((prev) => {
            if (prev === 0) {
                setSelectedYear((y) => y - 1);
                return 11;
            }
            return prev - 1;
        });
    };

    const goToNextMonth = () => {
        setSelectedMonthIndex((prev) => {
            if (prev === 11) {
                setSelectedYear((y) => y + 1);
                return 0;
            }
            return prev + 1;
        });
    };

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
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={goToPreviousMonth}
                                    className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 w-9 border border-neutral-200 dark:border-slate-500 hover:bg-neutral-100 dark:hover:bg-slate-600 transition-colors"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </button>
                                <span className="text-sm font-medium min-w-[140px] text-center">
                                    {MONTH_NAMES[selectedMonthIndex]} {selectedYear}
                                </span>
                                <button
                                    type="button"
                                    onClick={goToNextMonth}
                                    className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 w-9 border border-neutral-200 dark:border-slate-500 hover:bg-neutral-100 dark:hover:bg-slate-600 transition-colors"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
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

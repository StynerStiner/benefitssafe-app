"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import CustomSelect from "@/components/shared/custom-select";
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

function generateMonthOptions(): { label: string; value: string }[] {
    const months: { label: string; value: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const label = d.toLocaleString("default", { month: "long", year: "numeric" });
        const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        months.push({ label, value });
    }
    return months;
}

const EthPriceCard = ({ cards }: { cards: VirtualCard[] }) => {
    const monthOptions = useMemo(() => generateMonthOptions(), []);
    const [selectedMonth, setSelectedMonth] = useState<string>(monthOptions[0]?.value || "");

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

    const optionLabels = monthOptions.map((m) => m.label);
    const selectedLabel = monthOptions.find((m) => m.value === selectedMonth)?.label || monthOptions[0]?.label || "";

    const handleMonthChange = (label: string) => {
        const match = monthOptions.find((m) => m.label === label);
        if (match) {
            setSelectedMonth(match.value);
        }
    };

    return (
        <Card className="card h-full rounded-lg border-0 !p-0">
            <CardContent className="card-body p-0 flex flex-col justify-between gap-8">
                <div>
                    <div className="card-header border-b border-neutral-200 dark:border-slate-500 py-4 px-6">
                        <div className="flex items-center flex-wrap gap-2 justify-between">
                            <h6 className="font-bold text-lg mb-0">Card Spending</h6>
                            <CustomSelect
                                placeholder={selectedLabel}
                                options={optionLabels}
                                value={selectedLabel}
                                onValueChange={handleMonthChange}
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

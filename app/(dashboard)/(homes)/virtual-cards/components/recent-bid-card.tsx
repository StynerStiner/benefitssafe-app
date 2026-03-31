"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import CustomSelect from "@/components/shared/custom-select";
import RecentBidTable from "@/components/table/recent-bid-table";

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

const FILTER_OPTIONS = ["All Items", "New Item", "Trending Item", "Old Item"] as const;

const RecentBidCard = ({ cards }: { cards: VirtualCard[] }) => {
    const [filter, setFilter] = useState<string>("All Items");

    const filteredCards = useMemo(() => {
        const now = new Date();

        switch (filter) {
            case "New Item": {
                const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                return cards.filter((card) => new Date(card.createdAt) >= sevenDaysAgo);
            }
            case "Trending Item": {
                return cards.filter(
                    (card) =>
                        card.status === "ACTIVE" &&
                        card.expense !== null &&
                        card.expense !== undefined
                );
            }
            case "Old Item": {
                const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                return cards.filter((card) => new Date(card.createdAt) < thirtyDaysAgo);
            }
            case "All Items":
            default:
                return cards;
        }
    }, [cards, filter]);

    const filteredCardIds = useMemo(
        () => filteredCards.map((c) => c.id),
        [filteredCards]
    );

    return (
        <>
            <Card className="card !p-4">
                <CardContent className="px-0">
                    <div className="flex items-center flex-wrap gap-2 justify-between mb-5">
                        <h6 className="font-bold text-lg mb-0">Recent Card Activity</h6>
                        <CustomSelect
                            placeholder="All Items"
                            options={[...FILTER_OPTIONS]}
                            value={filter}
                            onValueChange={setFilter}
                        />
                    </div>

                    <RecentBidTable filterCardIds={filteredCardIds} filterActive={filter !== "All Items"} />

                </CardContent>
            </Card>
        </>
    );
};

export default RecentBidCard;

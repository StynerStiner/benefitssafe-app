"use client";

import CommonLink from "@/components/shared/common-link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import Image from "next/image";
import React from "react";
import CardActions from "./card-actions";

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

interface TopCreatorsCardProps {
    cards: VirtualCard[];
    onRefresh: () => void;
    onCardClick: (card: VirtualCard) => void;
}

function getStatusVariant(status: string) {
    switch (status?.toUpperCase()) {
        case "ACTIVE":
            return "success";
        case "FROZEN":
            return "warning";
        case "CANCELLED":
            return "danger";
        default:
            return "secondary";
    }
}

const TopCreatorsCard = ({ cards, onRefresh, onCardClick }: TopCreatorsCardProps) => {
    const displayCards = cards.slice(0, 6);

    if (displayCards.length === 0) {
        return (
            <Card className="card h-full rounded-lg border-0 !p-0">
                <CardContent className="card-body p-0 flex flex-col justify-between gap-8">
                    <div>
                        <div className="card-header border-b border-neutral-200 dark:border-slate-500 py-4 px-6">
                            <h3 className="font-bold text-lg mb-0">Card Assignments</h3>
                        </div>
                        <div className="card-body px-6 py-5">
                            <p className="text-neutral-500 dark:text-neutral-300">No cards assigned</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="card h-full rounded-lg border-0 !p-0">
            <CardContent className="card-body p-0 flex flex-col justify-between gap-8">
                <div>
                    <div className="card-header border-b border-neutral-200 dark:border-slate-500 py-4 px-6">
                        <div className="flex items-center flex-wrap gap-2 justify-between">
                            <h3 className="font-bold text-lg mb-0">Card Assignments</h3>
                            <CommonLink />
                        </div>
                    </div>

                    <div className="card-body px-6 py-5">
                        {displayCards.map((card, index) => (
                            <div
                                key={card.id}
                                className={`flex items-center justify-between gap-2 flex-wrap ${index !== displayCards.length - 1 ? "mb-[32px]" : "mb-0"}`}
                            >
                                <div
                                    className="flex items-center cursor-pointer flex-1 min-w-0"
                                    onClick={() => onCardClick(card)}
                                    title="View card details"
                                >
                                    {card.beneficiary?.avatarUrl ? (
                                        <Image
                                            src={card.beneficiary.avatarUrl}
                                            alt={`${card.beneficiary.firstName} ${card.beneficiary.lastName}`}
                                            width={40}
                                            height={40}
                                            className="flex-shrink-0 w-10 h-10 rounded-full me-3 object-cover"
                                        />
                                    ) : (
                                        <div className="flex-shrink-0 w-10 h-10 rounded-full me-3 bg-primary text-white flex items-center justify-center text-sm font-semibold">
                                            {card.beneficiary?.firstName?.[0]}{card.beneficiary?.lastName?.[0]}
                                        </div>
                                    )}
                                    <div className="flex-grow-1">
                                        <h6 className="text-base mb-0 font-semibold">
                                            {card.beneficiary?.firstName} {card.beneficiary?.lastName}
                                        </h6>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-neutral-500 dark:text-neutral-300 font-normal">
                                                **** {card.last4}
                                            </span>
                                            <Badge variant={getStatusVariant(card.status)} className="text-[10px] px-2 py-0">
                                                {card.status}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                                <CardActions
                                    cardId={card.id}
                                    cardLast4={card.last4}
                                    status={card.status}
                                    onActionComplete={onRefresh}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default TopCreatorsCard;

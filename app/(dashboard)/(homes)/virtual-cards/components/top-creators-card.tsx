"use client";

import CommonLink from "@/components/shared/common-link";
import { Card, CardContent } from "@/components/ui/card";
import Image from "next/image";
import React from "react";

interface VirtualCard {
    id: string;
    last4: string;
    spendingCap: string | null;
    cardType: string;
    status: string;
    beneficiary: {
        id: string;
        firstName: string;
        lastName: string;
        avatarUrl: string | null;
    } | null;
    vendor: { id: string; name: string; type: string } | null;
    expense: { id: string; description: string; amount: string } | null;
}

const TopCreatorsCard = ({ cards }: { cards: VirtualCard[] }) => {
    const displayCards = cards.slice(0, 6);

    if (displayCards.length === 0) {
        return (
            <Card className="card h-full rounded-lg border-0 !p-0">
                <CardContent className="card-body p-0 flex flex-col justify-between gap-8">
                    <div>
                        <div className="card-header border-b border-neutral-200 dark:border-slate-500 py-4 px-6">
                            <h6 className="font-bold text-lg mb-0">Card Assignments</h6>
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
                            <h6 className="font-bold text-lg mb-0">Card Assignments</h6>
                            <CommonLink />
                        </div>
                    </div>

                    <div className="card-body px-6 py-5">
                        {displayCards.map((card, index) => (
                            <div
                                key={card.id}
                                className={`flex items-center justify-between gap-2 flex-wrap ${index !== displayCards.length - 1 ? "mb-[32px]" : "mb-0"}`}
                            >
                                <div className="flex items-center">
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
                                        <span className="text-sm text-neutral-500 dark:text-neutral-300 font-normal">
                                            •••• {card.last4}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default TopCreatorsCard;

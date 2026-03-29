'use client';

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import React, { useEffect, useState } from "react";

import CardBG from "@/public/assets/images/card/card-bg.png";
import CardLogo from "@/public/assets/images/card/card-logo.png";

type VirtualCard = {
    id: string;
    beneficiaryId: string;
    beneficiaryName: string;
    cardholderName: string;
    last4: string;
    status: string;
    spendingLimit?: number;
    restrictions?: string;
};

interface TrendingNftWidgetsProps {
    category?: string;
}

const TrendingNftWidgets: React.FC<TrendingNftWidgetsProps> = ({ category = "all" }) => {
    const [cards, setCards] = useState<VirtualCard[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/virtual-cards?limit=100")
            .then((res) => res.ok ? res.json() : { data: [] })
            .then((json) => {
                const cardList = Array.isArray(json) ? json : (json.data ?? json.cards ?? []);
                setCards(cardList);
            })
            .catch(() => setCards([]))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="flex overflow-x-auto gap-6 pb-2">
                <div className="animate-pulse w-[280px] h-[350px] bg-slate-200 dark:bg-slate-700 rounded flex-shrink-0"></div>
                <div className="animate-pulse w-[280px] h-[350px] bg-slate-200 dark:bg-slate-700 rounded flex-shrink-0"></div>
            </div>
        );
    }

    const filtered = cards.filter(c => c.status !== 'archived');
    if (filtered.length === 0) {
        return (
            <div className="text-center py-8 text-neutral-500">
                <p>No virtual cards available</p>
            </div>
        );
    }

    return (
        <div className="flex overflow-x-auto gap-6 pb-2">
            {filtered.map((card) => (
                <div
                    key={card.id}
                    className="nft-card bg-white dark:bg-slate-800 rounded overflow-hidden w-[280px] flex-shrink-0"
                >
                    <div className="rounded-lg overflow-hidden relative z-[1] p-4 aspect-[1.586/1]">
                        <Image
                            src={CardBG}
                            alt="BG"
                            fill
                            className="absolute start-0 top-0 w-full h-full object-cover -z-[1]"
                        />
                        <div className="flex flex-col justify-between h-full">
                            <div className="flex items-center justify-between flex-wrap">
                                <h6 className="text-white mb-0 text-sm">Virtual Card</h6>
                                <Image src={CardLogo} alt="Logo" width={50} height={30} className="w-[50px] h-[30px]" />
                            </div>
                            <div>
                                <span className="text-white text-xs font-normal text-opacity-75">Card Number</span>
                                <h6 className="text-white text-base font-semibold mt-1 mb-0">**** **** **** {card.last4}</h6>
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <span className="text-white text-xs font-normal text-opacity-75">Name</span>
                                    <h6 className="text-white text-sm font-semibold mb-0">{card.cardholderName}</h6>
                                </div>
                                <div>
                                    <span className="text-white text-xs font-normal text-opacity-75">Limit</span>
                                    <h6 className="text-white text-sm font-semibold mb-0">${card.spendingLimit?.toLocaleString() || 'Unlimited'}</h6>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="p-2.5">
                        <h6 className="text-base font-bold text-neutral-600 dark:text-white mb-1">
                            {card.cardholderName}
                        </h6>

                        {/* Beneficiary Info */}
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-slate-300 dark:bg-slate-600 flex items-center justify-center text-xs font-semibold">
                                {card.beneficiaryName.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-sm text-neutral-500 dark:text-neutral-300 font-medium">
                                {card.beneficiaryName}
                            </span>
                        </div>

                        {/* Status Info */}
                        <div className="mt-2.5 flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                                {card.status}
                            </span>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center flex-wrap mt-3 gap-2">
                            <Link
                                href={`/virtual-cards/${card.id}/transactions`}
                                className="btn rounded-full border text-neutral-500 dark:text-neutral-300 border-neutral-500 dark:border-neutral-300 px-3 py-1.5 hover:bg-neutral-500 dark:hover:bg-slate-600 hover:text-white flex-grow text-center duration-200"
                            >
                                Transactions
                            </Link>
                            <Button
                                className={cn(
                                    "h-[39px] px-3 !py-1.5 flex-grow text-center rounded-full duration-200"
                                )}
                                asChild
                            >
                                <Link href={`/virtual-cards/${card.id}`}>Manage</Link>
                            </Button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default TrendingNftWidgets;

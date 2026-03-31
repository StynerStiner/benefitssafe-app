"use client"

import { Badge } from "@/components/ui/badge";
import CommonLink from "@/components/shared/common-link";
import { Card, CardContent } from "@/components/ui/card";
import CardBG from '@/public/assets/images/card/card-bg.png';
import CardLogo from '@/public/assets/images/card/card-logo.png';
import Image from 'next/image';
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

interface FeaturedCreatorsCardProps {
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

const FeaturedCreatorsCard = ({ cards, onRefresh, onCardClick }: FeaturedCreatorsCardProps) => {
    const displayCards = cards.slice(0, 2);
    const firstCard = displayCards[0];
    const beneficiaryName = firstCard?.beneficiary
        ? `${firstCard.beneficiary.firstName} ${firstCard.beneficiary.lastName}`
        : "No Beneficiary";

    if (!firstCard) {
        return (
            <Card className="card h-full rounded-lg border-0 !p-0">
                <CardContent className="card-body p-0 flex flex-col justify-between gap-8">
                    <div>
                        <div className="card-header border-b border-neutral-200 dark:border-slate-500 py-4 px-6">
                            <h6 className="font-bold text-lg mb-0">Assigned Cards</h6>
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
                            <h6 className="font-bold text-lg mb-0">Assigned Cards</h6>
                            <CommonLink />
                        </div>
                    </div>
                    <div className="card-body px-6 py-5">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center">
                                {firstCard.beneficiary?.avatarUrl ? (
                                    <Image
                                        src={firstCard.beneficiary.avatarUrl}
                                        alt={beneficiaryName}
                                        width={40}
                                        height={40}
                                        className="flex-shrink-0 w-10 h-10 rounded-full me-3 object-cover"
                                    />
                                ) : (
                                    <div className="flex-shrink-0 w-10 h-10 rounded-full me-3 bg-primary text-white flex items-center justify-center text-sm font-semibold">
                                        {firstCard.beneficiary?.firstName?.[0]}{firstCard.beneficiary?.lastName?.[0]}
                                    </div>
                                )}
                                <div className="flex-grow-1">
                                    <h6 className="text-base mb-0 font-semibold">{beneficiaryName}</h6>
                                    <span className="text-sm text-neutral-500 dark:text-neutral-300 font-normal">Beneficiary</span>
                                </div>
                            </div>
                        </div>
                        <div className="mt-6">
                            <div className="grid grid-cols-2 gap-6">
                                {displayCards.map((card) => (
                                    <div key={card.id} className="nft-card bg-white dark:bg-slate-700 rounded overflow-hidden shadow-4">
                                        <div
                                            className="rounded-lg overflow-hidden relative z-[1] p-3 aspect-[1.586/1] cursor-pointer"
                                            onClick={() => onCardClick(card)}
                                            title="View card details"
                                        >
                                            <Image src={CardBG} alt="BG" fill
                                                className="absolute start-0 top-0 w-full h-full object-cover -z-[1]" />
                                            <div className="flex flex-col justify-between h-full">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-white text-xs">Virtual Card</span>
                                                    <Image src={CardLogo} alt="Logo" width={30} height={18} className="w-[30px] h-[18px]" />
                                                </div>
                                                <div>
                                                    <span className="text-white text-[10px] font-normal text-opacity-75">**** {card.last4}</span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-white text-[10px]">{beneficiaryName}</span>
                                                    <span className="text-white text-[10px]">${card.spendingCap || '0'}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="p-3">
                                            <div className="flex items-center justify-between mb-3">
                                                <h6 className="text-base font-bold text-[#0a0a0a] dark:text-white mb-0">
                                                    {card.vendor?.name || 'Card'} ({card.last4})
                                                </h6>
                                                <Badge variant={getStatusVariant(card.status)} className="text-[10px] px-2 py-0">
                                                    {card.status}
                                                </Badge>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Image src={CardLogo}
                                                        className="w-28-px h-28-px rounded-full object-fit-cover" alt="Logo" />
                                                    <span className="text-sm text-neutral-500 dark:text-neutral-300 font-medium">
                                                        ${card.spendingCap || '0'} cap
                                                    </span>
                                                </div>
                                                <CardActions
                                                    cardId={card.id}
                                                    cardLast4={card.last4}
                                                    status={card.status}
                                                    onActionComplete={onRefresh}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default FeaturedCreatorsCard;

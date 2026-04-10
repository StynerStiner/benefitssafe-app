"use client";

import NftPromoBanner from "@/app/(dashboard)/(homes)/virtual-cards/components/nft-promo-banner";
import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import LoadingSkeleton from "@/components/loading-skeleton";
import PageDateFilter from "@/components/shared/page-date-filter";
import { CreditCard, Landmark } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import CardDetailDialog from "./components/card-detail-dialog";
import EthPriceCard from "./components/eth-price-card";
import FeaturedCreatorsCard from "./components/featured-creators-card";
import RecentBidCard from "./components/recent-bid-card";
import StatisticsCard from "./components/statistics-card";
import TopCreatorsCard from "./components/top-creators-card";
import TrendingBidWidgets from "./components/trending-bid-widgets";
import TrendingNftCard from "./components/trending-nft-card";

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

const VirtualCardsPage = () => {
    const [cards, setCards] = useState<VirtualCard[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedCard, setSelectedCard] = useState<VirtualCard | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);
    const [bankConnected, setBankConnected] = useState(true);
    const now = new Date();
    const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());

    const fetchCards = useCallback(() => {
        fetch("/api/virtual-cards?limit=100")
            .then((r) => r.ok ? r.json() : { data: [] })
            .then((json) => {
                const items = Array.isArray(json) ? json : json.data;
                if (Array.isArray(items)) setCards(items);
            })
            .catch(() => {
                setError("Failed to load virtual cards. Please try refreshing the page.");
            })
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        fetchCards();
        fetch("/api/org/stripe-account")
            .then((r) => r.ok ? r.json() : null)
            .then((data) => {
                if (data) setBankConnected(!!data.stripeAccountId);
            })
            .catch(() => {});
    }, [fetchCards]);

    const handleRefresh = useCallback(() => {
        fetchCards();
    }, [fetchCards]);

    const handleCardClick = useCallback((card: VirtualCard) => {
        setSelectedCard(card);
        setDetailOpen(true);
    }, []);

    if (loading) {
        return (
            <>
                <DashboardBreadcrumb title="Virtual Cards" text="Card Management" />
                <LoadingSkeleton />
            </>
        );
    }

    return (
        <>
            <div className="flex items-center justify-between">
                <DashboardBreadcrumb title="Virtual Cards" text="Card Management" />
                <PageDateFilter
                    selectedMonth={selectedMonth}
                    selectedYear={selectedYear}
                    onChange={(month, year) => {
                        setSelectedMonth(month);
                        setSelectedYear(year);
                    }}
                />
            </div>

            {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
            )}

            {!bankConnected && (
                <div className="mb-6 p-8 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-center">
                    <Landmark className="w-12 h-12 text-amber-400 mx-auto mb-3" />
                    <h3 className="text-lg font-semibold text-neutral-600 dark:text-neutral-300 mb-1">Connect your bank account to issue cards</h3>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
                        A connected bank account is required to fund virtual cards and disburse grant funds.
                    </p>
                    <Link
                        href="/org-settings?tab=funding"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
                    >
                        <Landmark className="w-4 h-4" />
                        Connect Bank Account
                    </Link>
                </div>
            )}

            {bankConnected && cards.length === 0 && (
                <div className="mb-6 p-8 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-center">
                    <CreditCard className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
                    <h3 className="text-lg font-semibold text-neutral-600 dark:text-neutral-300 mb-1">No virtual cards yet</h3>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
                        Cards will appear here once your expense requests are approved and a card is issued by your organization.
                    </p>
                </div>
            )}

            <div className="gap-6 grid grid-cols-1 2xl:grid-cols-12">
                <div className="col-span-12 2xl:col-span-8">
                    <div className="gap-6 grid grid-cols-1 sm:grid-cols-12">
                        <div className="col-span-12">
                            <NftPromoBanner cards={cards} />
                        </div>

                        <div className="col-span-12">
                            <TrendingBidWidgets cards={cards} />
                        </div>

                        <div className="col-span-12">
                            <TrendingNftCard cards={cards} />
                        </div>

                        <div className="col-span-12">
                            <RecentBidCard cards={cards} />
                        </div>
                    </div>
                </div>

                <div className="col-span-12 2xl:col-span-4">
                    <div className="gap-6 grid grid-cols-1 sm:grid-cols-12">
                        <div className="col-span-12 md:col-span-6 2xl:col-span-12">
                            <EthPriceCard cards={cards} selectedMonth={selectedMonth} selectedYear={selectedYear} />
                        </div>
                        <div className="col-span-12 md:col-span-6 2xl:col-span-12">
                            <StatisticsCard cards={cards} />
                        </div>
                        <div className="col-span-12 md:col-span-6 2xl:col-span-12">
                            <FeaturedCreatorsCard
                                cards={cards}
                                onRefresh={handleRefresh}
                                onCardClick={handleCardClick}
                            />
                        </div>
                        <div className="col-span-12 md:col-span-6 2xl:col-span-12">
                            <TopCreatorsCard
                                cards={cards}
                                onRefresh={handleRefresh}
                                onCardClick={handleCardClick}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <CardDetailDialog
                card={selectedCard}
                open={detailOpen}
                onOpenChange={setDetailOpen}
            />
        </>
    );
};
export default VirtualCardsPage;

"use client";

import NftPromoBanner from "@/app/(dashboard)/(homes)/virtual-cards/components/nft-promo-banner";
import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import LoadingSkeleton from "@/components/loading-skeleton";
import { useEffect, useState } from "react";
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
    cardType: string;
    status: string;
    createdAt: string;
    vendor: { id: string; name: string; type: string } | null;
    expense: { id: string; description: string; amount: string } | null;
}

const VirtualCardsPage = () => {
    const [cards, setCards] = useState<VirtualCard[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
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
            <DashboardBreadcrumb title="Virtual Cards" text="Card Management" />

            {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
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
                            <EthPriceCard cards={cards} />
                        </div>
                        <div className="col-span-12 md:col-span-6 2xl:col-span-12">
                            <StatisticsCard cards={cards} />
                        </div>
                        <div className="col-span-12 md:col-span-6 2xl:col-span-12">
                            <FeaturedCreatorsCard cards={cards} />
                        </div>
                        <div className="col-span-12 md:col-span-6 2xl:col-span-12">
                            <TopCreatorsCard cards={cards} />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};
export default VirtualCardsPage;

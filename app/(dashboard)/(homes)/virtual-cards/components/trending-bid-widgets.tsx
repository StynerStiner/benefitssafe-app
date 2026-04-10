"use client";

import { cn } from "@/lib/utils";
import { ArrowUp, UsersRound } from "lucide-react";
import React from "react";

interface VirtualCard {
    status: string;
    spendingCap: string | null;
}

const TrendingBidWidgets = ({ cards }: { cards: any[] }) => {
    const active = cards.filter((c) => c.status === "ACTIVE").length;
    const paused = cards.filter((c) => c.status === "FROZEN").length;
    const totalCap = cards
        .filter((c) => c.status === "ACTIVE")
        .reduce((s, c) => s + parseFloat(c.spendingCap || "0"), 0);

    const trendingBids = [
        {
            id: 1,
            value: active.toLocaleString(),
            label: "Active Cards",
            percentage: `${cards.length} total`,
            icon: <UsersRound />,
            iconBg: "bg-primary",
            trend: "up" as const,
            bgGradientClass: "bg-linear-to-r from-blue-600/10 to-bg-transparent",
            percentageBgClass: "bg-green-100 dark:bg-green-600/25",
            percentageTextClass: "text-green-600 dark:text-green-500",
        },
        {
            id: 2,
            value: paused.toLocaleString(),
            label: "Paused",
            percentage: `${paused} frozen`,
            icon: <UsersRound />,
            iconBg: "bg-red-600",
            trend: "up" as const,
            bgGradientClass: "bg-linear-to-r from-red-600/10 to-bg-transparent",
            percentageBgClass: "bg-red-100 dark:bg-red-600/25",
            percentageTextClass: "text-red-600 dark:text-red-500",
        },
        {
            id: 3,
            value: `$${totalCap.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
            label: "Total Cap",
            percentage: `${active} active`,
            icon: <UsersRound />,
            iconBg: "bg-violet-600",
            trend: "up" as const,
            bgGradientClass: "bg-linear-to-r from-violet-600/10 to-bg-transparent",
            percentageBgClass: "bg-green-100 dark:bg-green-600/25",
            percentageTextClass: "text-green-600 dark:text-green-500",
        },
    ];

    return (
        <>
            <h3 className="mb-4">Card Summary</h3>
            <div className="gap-6 grid grid-cols-1 sm:grid-cols-12">
                {trendingBids.map((item) => (
                    <div
                        key={item.id}
                        className="col-span-12 sm:col-span-6 lg:col-span-4"
                    >
                        <div
                            className={`card !border border-slate-300/50 dark:border-slate-600 px-6 py-4 shadow-none rounded-xl h-full ${item.bgGradientClass}`}
                        >
                            <div className="card-body p-0">
                                <div className="flex flex-wrap items-center justify-between gap-1">
                                    <div className="flex items-center flex-wrap gap-4">
                                        <span className={cn(`w-10 h-10 ${item.iconBg} flex-shrink-0 text-white flex justify-center items-center rounded-full h6 mb-0`)}>
                                            {item.icon}
                                        </span>

                                        <div className="flex-grow-1">
                                            <h6 className="font-semibold mb-0">{item.value}</h6>
                                            <span className="font-medium text-neutral-500 dark:text-neutral-300 text-base">
                                                {item.label}
                                            </span>
                                            <p className="text-sm mb-0 flex items-center flex-wrap gap-3 mt-3 text-neutral-500 dark:text-white">
                                                <span
                                                    className={`${item.percentageBgClass} px-1.5 py-0.5 rounded-sm font-medium ${item.percentageTextClass} text-sm flex items-center gap-2`}
                                                >
                                                    {item.percentage}
                                                    <ArrowUp width={14} />
                                                </span>
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
};

export default TrendingBidWidgets;

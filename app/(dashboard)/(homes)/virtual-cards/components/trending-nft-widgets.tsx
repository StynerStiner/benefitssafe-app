import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Image, { StaticImageData } from "next/image";
import Link from "next/link";
import React from "react";

import CardBG from "@/public/assets/images/card/card-bg.png";
import CardLogo from "@/public/assets/images/card/card-logo.png";

import UserImage1 from "@/public/assets/images/nft/nft-user-img1.png";
import UserImage2 from "@/public/assets/images/nft/nft-user-img2.png";
import UserImage3 from "@/public/assets/images/nft/nft-user-img3.png";
import UserImage4 from "@/public/assets/images/nft/nft-user-img4.png";

type NftCard = {
    id: number;
    title: string;
    cardType: string;
    last4: string;
    userImage: StaticImageData;
    userName: string;
    priceEth: string;
    priceUsd: string;
    category: string;
};

const nftCards: NftCard[] = [
    {
        id: 1,
        title: "Adobe Card (4242)",
        cardType: "Virtual Card",
        last4: "4242",
        userImage: UserImage1,
        userName: "James Carter",
        priceEth: "Cap: $660",
        priceUsd: "$5,709",
        category: "recurring",
    },
    {
        id: 2,
        title: "Scrivener Card (8888)",
        cardType: "Virtual Card",
        last4: "8888",
        userImage: UserImage2,
        userName: "James Carter",
        priceEth: "Cap: $660",
        priceUsd: "$5,709",
        category: "single-use",
    },
    {
        id: 3,
        title: "General Services (1234)",
        cardType: "Virtual Card",
        last4: "1234",
        userImage: UserImage3,
        userName: "James Carter",
        priceEth: "Cap: $660",
        priceUsd: "$5,709",
        category: "recurring",
    },
    {
        id: 4,
        title: "General Services (1234)",
        cardType: "Virtual Card",
        last4: "1234",
        userImage: UserImage4,
        userName: "James Carter",
        priceEth: "Cap: $660",
        priceUsd: "$5,709",
        category: "multi-vendor",
    },
];

function shuffleArray<T>(array: T[]): T[] {
    return [...array].sort(() => Math.random() - 0.5);
}

interface TrendingNftWidgetsProps {
    category: string;
}

const TrendingNftWidgets: React.FC<TrendingNftWidgetsProps> = ({ category }) => {
    let filtered = category === "all" ? nftCards : nftCards.filter(c => c.category === category);

    let shuffled = shuffleArray(filtered);

    return (
        <div className="flex overflow-x-auto gap-6 pb-2">
            {shuffled.map((card) => (
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
                                <h6 className="text-white mb-0 text-sm">{card.cardType}</h6>
                                <Image src={CardLogo} alt="Logo" width={50} height={30} className="w-[50px] h-[30px]" />
                            </div>
                            <div>
                                <span className="text-white text-xs font-normal text-opacity-75">Card Number</span>
                                <h6 className="text-white text-base font-semibold mt-1 mb-0">**** **** **** {card.last4}</h6>
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <span className="text-white text-xs font-normal text-opacity-75">Name</span>
                                    <h6 className="text-white text-sm font-semibold mb-0">{card.userName}</h6>
                                </div>
                                <div>
                                    <span className="text-white text-xs font-normal text-opacity-75">Cap</span>
                                    <h6 className="text-white text-sm font-semibold mb-0">{card.priceEth.replace("Cap: ", "")}</h6>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="p-2.5">
                        <h6 className="text-base font-bold text-neutral-600 dark:text-white mb-1">
                            {card.title}
                        </h6>

                        {/* User Info */}
                        <div className="flex items-center gap-2">
                            <Image
                                src={card.userImage}
                                className="w-7 h-7 rounded-full object-cover"
                                alt={card.userName}
                                width={28}
                                height={28}
                            />
                            <span className="text-sm text-neutral-500 dark:text-neutral-300 font-medium">
                                {card.userName}
                            </span>
                        </div>

                        {/* Price Info */}
                        <div className="mt-2.5 flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-sm text-neutral-500 dark:text-neutral-300 font-medium">
                                {""}
                                <span className="text-sm text-neutral-600 dark:text-white font-semibold">
                                    {card.priceEth}
                                </span>
                            </span>
                            <span className="text-sm font-semibold text-blue-600">
                                {card.priceUsd}
                            </span>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center flex-wrap mt-3 gap-2">
                            <Link
                                href="#"
                                className="btn rounded-full border text-neutral-500 dark:text-neutral-300 border-neutral-500 dark:border-neutral-300 px-3 py-1.5 hover:bg-neutral-500 dark:hover:bg-slate-600 hover:text-white flex-grow text-center duration-200"
                            >
                                Transactions
                            </Link>
                            <Button
                                className={cn(
                                    "h-[39px] px-3 !py-1.5 flex-grow text-center rounded-full duration-200"
                                )}
                            >
                                <Link href="#">Manage</Link>
                            </Button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default TrendingNftWidgets;

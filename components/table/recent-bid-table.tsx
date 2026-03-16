"use client";

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { SquarePen, Trash } from "lucide-react";
import Image, { StaticImageData } from "next/image";
import { useState } from "react";
import toast from "react-hot-toast";
import { Button } from "../ui/button";

import nftItemImage1 from "@/public/assets/images/nft/nft-items-img1.png";
import nftItemImage2 from "@/public/assets/images/nft/nft-items-img2.png";
import nftItemImage3 from "@/public/assets/images/nft/nft-items-img3.png";
import nftItemImage4 from "@/public/assets/images/nft/nft-items-img4.png";
import nftItemImage5 from "@/public/assets/images/nft/nft-items-img5.png";
import nftItemImage6 from "@/public/assets/images/nft/nft-items-img6.png";

import nftOfferImage1 from "@/public/assets/images/nft/nft-offer-img1.png";
import nftOfferImage2 from "@/public/assets/images/nft/nft-offer-img2.png";
import nftOfferImage3 from "@/public/assets/images/nft/nft-offer-img3.png";
import nftOfferImage4 from "@/public/assets/images/nft/nft-offer-img4.png";
import nftOfferImage5 from "@/public/assets/images/nft/nft-offer-img5.png";
import nftOfferImage6 from "@/public/assets/images/nft/nft-offer-img6.png";
import nftOfferImage7 from "@/public/assets/images/nft/nft-offer-img7.png";

interface BidItem {
    itemImage: StaticImageData;
    itemTitle: string;
    itemOwner: string;
    price: string;
    yourOffer: string;
    recentOfferImage: StaticImageData;
    recentOfferPrice: string;
    timeLeft: string;
}

const initialBidData: BidItem[] = [
    {
        itemImage: nftItemImage1,
        itemTitle: "Adobe CC Monthly",
        itemOwner: "Software",
        price: "$54.99",
        yourOffer: "Adobe Inc",
        recentOfferImage: nftOfferImage1,
        recentOfferPrice: "4242",
        timeLeft: "Mar 1, 2026",
    },
    {
        itemImage: nftItemImage2,
        itemTitle: "Scrivener License",
        itemOwner: "Software",
        price: "$49.00",
        yourOffer: "Literature & Latte",
        recentOfferImage: nftOfferImage2,
        recentOfferPrice: "8888",
        timeLeft: "Feb 28, 2026",
    },
    {
        itemImage: nftItemImage3,
        itemTitle: "Maria's Editing",
        itemOwner: "Service",
        price: "$1,500.00",
        yourOffer: "Maria's Editing LLC",
        recentOfferImage: nftOfferImage3,
        recentOfferPrice: "1234",
        timeLeft: "Feb 25, 2026",
    },
    {
        itemImage: nftItemImage4,
        itemTitle: "Writing Coach",
        itemOwner: "Service",
        price: "$200.00",
        yourOffer: "Writing Coach LLC",
        recentOfferImage: nftOfferImage4,
        recentOfferPrice: "4242",
        timeLeft: "Feb 20, 2026",
    },
    {
        itemImage: nftItemImage5,
        itemTitle: "Print Shop",
        itemOwner: "Printing",
        price: "$175.00",
        yourOffer: "Bay Area Print",
        recentOfferImage: nftOfferImage5,
        recentOfferPrice: "1234",
        timeLeft: "Feb 15, 2026",
    },
    {
        itemImage: nftItemImage6,
        itemTitle: "Adobe CC Feb",
        itemOwner: "Software",
        price: "$54.99",
        yourOffer: "Adobe Inc",
        recentOfferImage: nftOfferImage6,
        recentOfferPrice: "4242",
        timeLeft: "Feb 1, 2026",
    },
    {
        itemImage: nftItemImage2,
        itemTitle: "Adobe CC Jan",
        itemOwner: "Software",
        price: "$54.99",
        yourOffer: "Adobe Inc",
        recentOfferImage: nftOfferImage7,
        recentOfferPrice: "4242",
        timeLeft: "Jan 1, 2026",
    },
];

const RecentBidTable = () => {
    const [bids, setBids] = useState<BidItem[]>(initialBidData);

    const handleRemove = (index: number) => {
        setBids((prev) => prev.filter((_, i) => i !== index));
        toast.success('Table item deleted successfully!')
    }

    return (
        <Table className="table-auto border-spacing-0 border-separate">
            <TableHeader>
                <TableRow className="border-0">
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-4 h-12 border-t border-s border-neutral-200 dark:border-slate-600 text-start rounded-tl-lg">
                        Transaction
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-4 h-12 border-t border-neutral-200 dark:border-slate-600">
                        Amount
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-4 h-12 border-t border-neutral-200 dark:border-slate-600">
                        Merchant
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-4 h-12 border-t border-neutral-200 dark:border-slate-600">
                        Card
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-4 h-12 border-t border-neutral-200 dark:border-slate-600">
                        Date
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-4 h-12 border-t border-e border-neutral-200 dark:border-slate-600 text-center rounded-tr-lg">
                        Action
                    </TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {bids.map((item, index) => {
                    const isLast = index === bids.length - 1;
                    return (
                        <TableRow key={index}>
                            <TableCell
                                className={`py-3 px-4 first:border-s last:border-e border-b border-neutral-200 dark:border-slate-600 text-start ${isLast ? "rounded-bl-lg" : ""
                                    }`}
                            >
                                <div className="flex items-center">
                                    <Image
                                        src={item.itemImage}
                                        alt={item.itemTitle}
                                        width={40}
                                        height={40}
                                        className="flex-shrink-0 w-10 h-10 rounded-full me-3"
                                    />
                                    <div className="flex-grow">
                                        <h6 className="text-base mb-0 font-semibold">
                                            {item.itemTitle}
                                        </h6>
                                        <span className="text-sm text-neutral-500 dark:text-neutral-300 font-normal">
                                            {item.itemOwner}
                                        </span>
                                    </div>
                                </div>
                            </TableCell>

                            <TableCell className="py-3 px-4 border-b border-neutral-200 dark:border-slate-600">
                                {item.price}
                            </TableCell>

                            <TableCell className="py-3 px-4 border-b border-neutral-200 dark:border-slate-600">
                                {item.yourOffer}
                            </TableCell>

                            <TableCell className="py-3 px-4 border-b border-neutral-200 dark:border-slate-600">
                                <div className="flex items-center">
                                    <Image
                                        src={item.recentOfferImage}
                                        alt={item.recentOfferPrice}
                                        width={40}
                                        height={40}
                                        className="flex-shrink-0 w-10 h-10 rounded-full me-3"
                                    />
                                    <div className="flex-grow">
                                        <h6 className="text-base mb-0 font-semibold text-[#0a0a0a] dark:text-white">
                                            {item.recentOfferPrice}
                                        </h6>
                                    </div>
                                </div>
                            </TableCell>

                            <TableCell className="py-3 px-4 border-b border-neutral-200 dark:border-slate-600">
                                {item.timeLeft}
                            </TableCell>

                            <TableCell className={`py-3 px-4 border-b border-e border-neutral-200 dark:border-slate-600 text-center ${isLast ? "rounded-br-2xl" : ""
                                }`} >
                                <div className="inline-flex items-center gap-3">
                                    <Button
                                        type="button"
                                        className={cn(`bg-transparent !p-0 shadow-none hover:bg-transparent text-xl text-green-500 dark:text-green-500`)}
                                    >
                                        <SquarePen width={18} />
                                    </Button>
                                    <Button
                                        type="button"
                                        className={cn(`bg-transparent !p-0 shadow-none hover:bg-transparent text-xl text-red-600 dark:text-red-500 remove-btn`)}
                                        onClick={() => handleRemove(index)}
                                    >
                                        <Trash width={18} />
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    );
                })}
            </TableBody>
        </Table>
    );
};

export default RecentBidTable;

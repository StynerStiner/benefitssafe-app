"use client";

import CommonLink from "@/components/shared/common-link";
import { Card, CardContent } from "@/components/ui/card";
import Image, { StaticImageData } from "next/image";
import { useState } from "react";

import podcasterImg1 from "@/public/assets/images/homeThirteen/podcaster-img1.png";
import podcasterImg2 from "@/public/assets/images/homeThirteen/podcaster-img2.png";
import podcasterImg3 from "@/public/assets/images/homeThirteen/podcaster-img3.png";
import podcasterImg4 from "@/public/assets/images/homeThirteen/podcaster-img4.png";
import podcasterImg5 from "@/public/assets/images/homeThirteen/podcaster-img5.png";

interface Podcaster {
    id: number;
    name: string;
    category: string;
    image: StaticImageData | string;
}

const podcastersData: Podcaster[] = [
    { id: 1, name: "Digital Assets", category: "UI Design", image: podcasterImg1 },
    { id: 2, name: "Side Project", category: "Business", image: podcasterImg2 },
    { id: 3, name: "Investment", category: "Lifestyle", image: podcasterImg3 },
    { id: 4, name: "Good Health", category: "Lifestyle", image: podcasterImg4 },
    { id: 5, name: "Episodes Name", category: "Motivation", image: podcasterImg5 },
];

const TopPodcasterCard = () => {
    const [following, setFollowing] = useState<number[]>([]);

    const handleFollowToggle = (id: number) => {
        setFollowing((prev) =>
            prev.includes(id) ? prev.filter((pid) => pid !== id) : [...prev, id]
        );
    };

    return (
        <Card className="card border-0 rounded-xl shadow-none p-0">
            <CardContent className="p-0">
                {/* Header */}
                <div className="border-b border-neutral-200 dark:border-slate-500 py-4 px-6 flex items-center justify-between flex-wrap gap-2">
                    <h6 className="font-semibold text-lg mb-0 text-foreground">
                        Top Podcaster
                    </h6>
                    <CommonLink />
                </div>

                {/* Body */}
                <div className="p-5 flex flex-col gap-5">
                    {podcastersData.map((podcaster) => (
                        <div
                            key={podcaster.id}
                            className="flex items-center justify-between gap-4"
                        >
                            {/* Left Side */}
                            <div className="flex items-center">
                                <Image
                                    src={podcaster.image}
                                    alt={podcaster.name}
                                    width={40}
                                    height={40}
                                    className="w-10 h-10 rounded-full me-3 object-cover"
                                />
                                <div>
                                    <h6 className="text-base mb-0 font-medium text-foreground">
                                        {podcaster.name}
                                    </h6>
                                    <span className="text-sm text-muted-foreground font-medium">
                                        {podcaster.category}
                                    </span>
                                </div>
                            </div>

                            {/* Follow Button */}
                            <button
                                type="button"
                                onClick={() => handleFollowToggle(podcaster.id)}
                                className={`cursor-pointer rounded px-5 py-1.5 font-medium transition-colors ${following.includes(podcaster.id)
                                    ? "bg-green-600 text-white hover:bg-green-700"
                                    : "bg-green-100 text-green-600 hover:bg-green-300"
                                    }`}
                            >
                                {following.includes(podcaster.id) ? "Following" : "Follow"}
                            </button>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};

export default TopPodcasterCard;

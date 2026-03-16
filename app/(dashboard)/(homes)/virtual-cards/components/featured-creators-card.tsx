"use client"

import CommonLink from "@/components/shared/common-link";
import { Button } from '@/components/ui/button';
import { Card, CardContent } from "@/components/ui/card";
import CardBG from '@/public/assets/images/card/card-bg.png';
import CardLogo from '@/public/assets/images/card/card-logo.png';
import NftImagesImage1 from '@/public/assets/images/nft/nft-items-img1.png';
import Image from 'next/image';
import { useState } from 'react';

const FeaturedCreatorsCard = ({ cards }: { cards: unknown[] }) => {

    const [follow, setFollow] = useState(false);

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
                                <Image src={NftImagesImage1} alt="Image"
                                    className="flex-shrink-0 w-10 h-10 rounded-full me-3" />
                                <div className="flex-grow-1">
                                    <h6 className="text-base mb-0 font-semibold">James Carter</h6>
                                    <span className="text-sm text-neutral-500 dark:text-neutral-300 font-normal">Beneficiary</span>
                                </div>
                            </div>
                            <Button type="button" variant="outline"
                                className="btn btn-outline-primary-600 px-6 rounded-full" onClick={() => setFollow(!follow)}>{follow ? "Following" : "View"}</Button>
                        </div>
                        <div className="mt-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div
                                    className="nft-card bg-white dark:bg-slate-700 rounded overflow-hidden shadow-4">
                                    <div className="rounded-lg overflow-hidden relative z-[1] p-3 aspect-[1.586/1]">
                                        <Image src={CardBG} alt="BG" fill
                                            className="absolute start-0 top-0 w-full h-full object-cover -z-[1]" />
                                        <div className="flex flex-col justify-between h-full">
                                            <div className="flex items-center justify-between">
                                                <span className="text-white text-xs">Virtual Card</span>
                                                <Image src={CardLogo} alt="Logo" width={30} height={18} className="w-[30px] h-[18px]" />
                                            </div>
                                            <div>
                                                <span className="text-white text-[10px] font-normal text-opacity-75">**** 4242</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-white text-[10px]">James Carter</span>
                                                <span className="text-white text-[10px]">$660</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-3">
                                        <h6 className="text-base font-bold text-[#0a0a0a] dark:text-white mb-3">Adobe Card (4242)</h6>
                                        <div className="flex items-center gap-2">
                                            <Image src={CardLogo}
                                                className="w-28-px h-28-px rounded-full object-fit-cover" alt="Image" />
                                            <span className="text-sm text-neutral-500 dark:text-neutral-300 font-medium">$660 cap</span>
                                        </div>
                                    </div>
                                </div>
                                <div
                                    className="nft-card bg-white dark:bg-slate-700 rounded overflow-hidden shadow-4">
                                    <div className="rounded-lg overflow-hidden relative z-[1] p-3 aspect-[1.586/1]">
                                        <Image src={CardBG} alt="BG" fill
                                            className="absolute start-0 top-0 w-full h-full object-cover -z-[1]" />
                                        <div className="flex flex-col justify-between h-full">
                                            <div className="flex items-center justify-between">
                                                <span className="text-white text-xs">Virtual Card</span>
                                                <Image src={CardLogo} alt="Logo" width={30} height={18} className="w-[30px] h-[18px]" />
                                            </div>
                                            <div>
                                                <span className="text-white text-[10px] font-normal text-opacity-75">**** 8888</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-white text-[10px]">James Carter</span>
                                                <span className="text-white text-[10px]">$49</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-3">
                                        <h6 className="text-base font-bold text-[#0a0a0a] dark:text-white mb-3">Scrivener Card (8888)
                                        </h6>
                                        <div className="flex items-center gap-2">
                                            <Image src={CardLogo}
                                                className="w-28-px h-28-px rounded-full object-fit-cover" alt="Image" />
                                            <span className="text-sm text-neutral-500 dark:text-neutral-300 font-medium">$49 cap</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default FeaturedCreatorsCard;
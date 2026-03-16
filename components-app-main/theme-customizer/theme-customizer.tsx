"use client";

import { useDirection } from "@/hooks/useDirection";
import { cn } from "@/lib/utils";
import { Settings, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "../ui/button";
import ColorCustomization from "./theme-components/color-customization";
import LightDarkMode from "./theme-components/light-dark-mode";
import ThemeDirection from "./theme-components/theme-direction";
import ThemeLayout from "./theme-components/theme-layout";


const ThemeCustomizer = () => {
    const [customizationOpen, setCustomizationOpen] = useState(false);
    const direction = useDirection();

    return (
        <>
            <Button
                className="fixed bottom-12 end-8 !p-0 shadow-xl rounded-full w-[50px] h-[50px] bg-primary text-white flex items-center justify-center overflow-hidden z-[2]"
                onClick={() => setCustomizationOpen(true)}
            >
                <Settings className="!w-7 !h-7 animate-spin fill-curren" />
            </Button>

            {
                customizationOpen && (
                    <div
                        className="overlay fixed w-full h-full bg-black/50 dark:bg-black/50 z-10 duration-700 transition-all"
                        onClick={() => setCustomizationOpen(false)}
                    >
                    </div>
                )
            }


            <div
                className={`fixed max-w-[420px] w-full h-screen bg-white dark:bg-slate-800 top-0 z-[11] shadow-2xl duration-500 transition-transform flex flex-col
                    ${direction === "rtl"
                        ? customizationOpen
                            ? "end-0 translate-x-0"        // RTL open → right side
                            : "end-0 translate-x-full hidden"     // RTL closed → hide right
                        : customizationOpen
                            ? "end-0 translate-x-0"        // LTR open → right side
                            : "end-0 translate-x-full hidden"     // LTR closed → hide right
                    }
                `}
            >

                <div className="flex items-center gap-6 px-6 py-4 border-b border-neutral-200 dark:border-slate-700 justify-between">
                    <div className="">
                        <h6 className="text-sm dark:text-white">Theme Settings</h6>
                        <p className="text-xs text-neutral-500 dark:text-neutral-200">Customize and preview instantly</p>
                    </div>
                    <div className="">
                        <Button
                            className={cn(`!py-0 !px-0 h-[unset] text-neutral-900  bg-transparent shadow-none rounded-md hover:bg-transparent hover:text-primary hover:rotate-90 duration-300`)}
                            onClick={() => setCustomizationOpen(false)}
                        >
                            <X className="!w-5 !h-5" />
                        </Button>
                    </div>
                </div>


                <div className="flex flex-col gap-12 px-6 py-6 overflow-y-auto grow">
                    <LightDarkMode />
                    <ThemeDirection />
                    <ColorCustomization />
                    <ThemeLayout />
                </div>

                <div className="px-6 py-3 border-t border-neutral-200 dark:border-slate-700">
                    <Button asChild className={cn(`h-12 w-full rounded-sm font-semibold text-base`)}>
                        <Link href="https://themeforest.net/item/wowdash-tailwind-nextjs-admin-dashboard-with-shadcn-ui/58810632?s_rank=2">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 19 19"
                                fill="none"
                                className="h-5 w-5"
                            >
                                <g clipPath="url(#clip0_10156_2589)">
                                    <path
                                        d="M14.9779 0.430692C14.3344 0.114562 11.0696 0.475693 8.71609 2.7336C5.00803 6.43603 5.09691 11.3141 5.09691 11.3141C5.09691 11.3141 4.97428 11.8159 4.45227 11.088C3.30925 9.63108 3.90776 6.27966 3.97526 5.81278C4.06976 5.15464 3.65013 5.13551 3.47575 5.35264C-0.65531 11.088 3.07525 15.7838 5.51766 17.2745C8.37746 19.0194 14.0183 19.0182 16.265 14.0682C19.064 7.90418 15.7846 0.825573 14.9779 0.430692Z"
                                        fill="currentColor"
                                    />
                                </g>
                                <defs>
                                    <clipPath id="clip0_10156_2589">
                                        <rect
                                            width="18"
                                            height="18"
                                            fill="currentColor"
                                            transform="translate(0.5 0.332031)"
                                        />
                                    </clipPath>
                                </defs>
                            </svg>
                            Purchase Now
                        </Link>
                    </Button>
                </div>

            </div >
        </>
    );
};

export default ThemeCustomizer;
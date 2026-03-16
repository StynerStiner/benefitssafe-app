"use client";

import { useDirection } from "@/hooks/useDirection";
import { useThemeCustomizer } from "@/hooks/useThemeCustomizer";
import { cn } from "@/lib/utils";
import { Settings, X } from "lucide-react";
import { Button } from "../ui/button";
import ColorCustomization from "./theme-components/color-customization";
import LightDarkMode from "./theme-components/light-dark-mode";
import ThemeDirection from "./theme-components/theme-direction";
import ThemeLayout from "./theme-components/theme-layout";


const ThemeCustomizer = () => {
    const { customizationOpen, setCustomizationOpen } = useThemeCustomizer();
    const direction = useDirection();

    return (
        <>
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
                    <Button
                        onClick={() => setCustomizationOpen(false)}
                        className="h-12 w-full rounded-sm font-semibold text-base bg-primary hover:bg-primary/90 text-white"
                    >
                        Close
                    </Button>
                </div>

            </div >
        </>
    );
};

export default ThemeCustomizer;
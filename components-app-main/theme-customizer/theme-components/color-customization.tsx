"use client";

import { Check } from "lucide-react";
import React, { useEffect, useState } from "react";

const colors = [
    { name: "Blue", hex: "rgb(56, 114, 250)" },
    { name: "Black", hex: "rgb(17, 17, 17)" },
    { name: "Teal", hex: "rgb(13, 148, 136)" },
    { name: "Violet", hex: "rgb(124, 58, 237)" },
    { name: "Rose", hex: "rgb(225, 29, 72)" },
    { name: "Yellow", hex: "rgb(202, 138, 4)" },
];

const ColorCustomization: React.FC = () => {
    const [selectedColor, setSelectedColor] = useState<string | null>(null);

    // Utility: pick white or black text based on background brightness
    const getContrastColor = (hex: string) => {
        const rgb = hex.match(/\d+/g)?.map(Number) || [0, 0, 0];
        const [r, g, b] = rgb;
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        return brightness > 150 ? "rgb(17, 17, 17)" : "rgb(255, 255, 255)";
    };

    const applyColor = (hex: string) => {
        const foreground = getContrastColor(hex);
        document.documentElement.style.setProperty("--primary", hex);
        document.documentElement.style.setProperty("--primary-foreground", foreground);
    };

    const handleColorChange = (hex: string) => {
        setSelectedColor(hex);
        applyColor(hex);
        localStorage.setItem("primaryColor", hex); // save to localStorage
    };

    // On page load, restore saved color
    useEffect(() => {
        const savedColor = localStorage.getItem("primaryColor");
        if (savedColor) {
            setSelectedColor(savedColor);
            applyColor(savedColor);
        }
    }, []);

    return (
        <div className="theme-setting-item">
            <h6 className="font-medium text-base mb-3">Color Scheme</h6>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {colors.map((color) => (
                    <div
                        key={color.name}
                        className="flex flex-col items-center justify-center gap-1 cursor-pointer"
                    >
                        <div className="relative w-full">
                            <button
                                title={color.name}
                                onClick={() => handleColorChange(color.hex)}
                                className={`grid w-full place-content-center gap-2 rounded-md border-2 py-1.5 shadow-sm transition duration-300 focus-visible:outline-none h-[38px] !cursor-pointer
                                    ${selectedColor === color.hex ? "border-primary ring-2 ring-offset-2" : "border-transparent"}
                                `}
                                style={{
                                    backgroundColor: color.hex,
                                    ["--tw-ring-color" as any]: selectedColor === color.hex ? color.hex : "transparent",
                                }}
                            />
                            {
                                selectedColor === color.hex && (
                                    <span className="absolute top-[50%] start-[50%] translate-x-[-50%] translate-y-[-50%] rtl:-translate-x-[-50%]">
                                        <Check className="text-white" />
                                    </span>
                                )
                            }
                        </div>
                        <span className="font-medium" style={{ color: color.hex }}>
                            {color.name}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ColorCustomization;


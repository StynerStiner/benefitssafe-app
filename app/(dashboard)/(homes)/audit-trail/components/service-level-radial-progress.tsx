"use client";

import { useEffect, useRef } from "react";

const ServiceLevelRadialProgress = () => {
    const svgRef = useRef<SVGSVGElement | null>(null);

    useEffect(() => {
        const svg = svgRef.current;
        if (!svg) return;

        const circle = svg.querySelector("circle.complete") as SVGCircleElement | null;
        if (!circle) return; // Safety

        // Read SVG attributes safely
        const percentAttr = svg.getAttribute("data-percentage");
        const percent = percentAttr ? Number(percentAttr) : 0;

        const radiusAttr = circle.getAttribute("r");
        const radius = radiusAttr ? Number(radiusAttr) : 0;

        // Prevent calculation errors
        if (!radius) return;

        const circumference = 2 * Math.PI * radius;

        // Set initial stroke values
        circle.style.strokeDasharray = `${circumference}`;
        circle.style.strokeDashoffset = `${circumference}`;

        const animate = () => {
            const offset = circumference - (percent / 100) * circumference;
            circle.style.transition = "stroke-dashoffset 1.2s ease";
            circle.style.strokeDashoffset = `${offset}`;
        };

        // Animate only when visible
        const observer = new IntersectionObserver(
            entries => {
                if (entries[0].isIntersecting) {
                    animate();
                    observer.disconnect();
                }
            },
            { threshold: 0.5 }
        );

        observer.observe(svg);
    }, []);

    return (
        <div className="flex items-center gap-[24px] 2xl:pe-[90px]">
            <div className="relative">
                <svg
                    ref={svgRef}
                    className="radial-progress h-auto max-w-[212px] w-full h-full rotate-0"
                    data-percentage="90"
                    viewBox="0 0 80 80"
                >
                    <circle
                        className="fill-none stroke-[6] stroke-[#e8e8e9]"
                        cx="40"
                        cy="40"
                        r="35"
                    />

                    {/* Animated circle */}
                    <circle
                        className="complete fill-none stroke-[6] stroke-[#3b82f6] [stroke-linecap:round]"
                        cx="40"
                        cy="40"
                        r="35"
                    />
                </svg>

                <div className="text-center absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                    <span className="font-semibold text-primary-light">Service Level</span>
                    <h3 className="mb-0 leading-none mt-1">85.7</h3>
                    <span className="text-neutral-500 dark:text-neutral-200 mt-2 mb-0">Target: 90%</span>
                </div>
            </div>

            <div>
                <h6 className="text-xl">Average CSAT</h6>
                <span className="font-medium text-neutral-500 dark:text-neutral-200">All time</span>

                <div className="mt-3 flex items-start gap-2.5">
                    <h4 className="mb-0">4.7</h4>
                    <span className="text-white bg-green-500 text-sm py-[2px] px-2.5 rounded-full mt-2">of 5</span>
                </div>
            </div>
        </div>
    );
};

export default ServiceLevelRadialProgress;

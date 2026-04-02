"use client";

import { useEffect, useRef, useMemo } from "react";

interface AuditLog {
    action: string;
    entityType: string;
    createdAt: string;
}

const ServiceLevelRadialProgress = ({ auditLogs = [] }: { auditLogs?: AuditLog[] }) => {
    const svgRef = useRef<SVGSVGElement | null>(null);

    const { complianceScore, avgResponseHours } = useMemo(() => {
        if (auditLogs.length === 0) return { complianceScore: 0, avgResponseHours: 0 };

        // Compliance score: ratio of non-delete/non-reject actions to total
        const positiveActions = auditLogs.filter(
            (l) => l.action !== "DELETE" && l.action !== "REJECT"
        ).length;
        const score = Math.round((positiveActions / auditLogs.length) * 1000) / 10;

        // Avg response time: average gap between consecutive actions (in hours)
        const sorted = [...auditLogs]
            .map((l) => new Date(l.createdAt).getTime())
            .sort((a, b) => a - b);
        let totalGap = 0;
        let gapCount = 0;
        for (let i = 1; i < sorted.length; i++) {
            totalGap += sorted[i] - sorted[i - 1];
            gapCount++;
        }
        const avgMs = gapCount > 0 ? totalGap / gapCount : 0;
        const avgHrs = Math.round((avgMs / (1000 * 60 * 60)) * 10) / 10;

        return { complianceScore: score, avgResponseHours: avgHrs };
    }, [auditLogs]);

    const displayPercentage = Math.min(complianceScore, 100);

    useEffect(() => {
        const svg = svgRef.current;
        if (!svg) return;

        const circle = svg.querySelector("circle.complete") as SVGCircleElement | null;
        if (!circle) return;

        const radiusAttr = circle.getAttribute("r");
        const radius = radiusAttr ? Number(radiusAttr) : 0;

        if (!radius) return;

        const circumference = 2 * Math.PI * radius;

        circle.style.strokeDasharray = `${circumference}`;
        circle.style.strokeDashoffset = `${circumference}`;

        const animate = () => {
            const offset = circumference - (displayPercentage / 100) * circumference;
            circle.style.transition = "stroke-dashoffset 1.2s ease";
            circle.style.strokeDashoffset = `${offset}`;
        };

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
    }, [displayPercentage]);

    return (
        <div className="flex items-center gap-[24px] 2xl:pe-[90px]">
            <div className="relative">
                <svg
                    ref={svgRef}
                    className="radial-progress h-auto max-w-[212px] w-full h-full rotate-0"
                    data-percentage={String(Math.round(displayPercentage))}
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
                    <span className="font-semibold text-primary-light">Compliance Score</span>
                    <h3 className="mb-0 leading-none mt-1">{complianceScore}</h3>
                    <span className="text-neutral-500 dark:text-neutral-200 mt-2 mb-0">Target: 90%</span>
                </div>
            </div>

            <div>
                <h6 className="text-xl">Avg Response Time</h6>
                <span className="font-medium text-neutral-500 dark:text-neutral-200">All time</span>

                <div className="mt-3 flex items-start gap-2.5">
                    <h4 className="mb-0">{avgResponseHours}</h4>
                    <span className="text-white bg-green-500 text-sm py-[2px] px-2.5 rounded-full mt-2">hrs</span>
                </div>
            </div>
        </div>
    );
};

export default ServiceLevelRadialProgress;

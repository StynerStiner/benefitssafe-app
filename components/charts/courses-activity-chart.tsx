// @ts-nocheck
"use client";

import { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import React from "react";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

interface CoursesActivityChartProps {
    height?: number; // optional prop, fallback if not passed
    series?: { name: string; data: number[] }[];
    categories?: string[];
}

const CoursesActivityChart: React.FC<CoursesActivityChartProps> = ({ height = 380, series: seriesProp, categories: categoriesProp }) => {
    const defaultSeries = [
        {
            name: "Net Profit",
            data: [44, 100, 40, 56, 30, 58, 50],
        },
        {
            name: "Free Cash",
            data: [60, 120, 60, 90, 50, 95, 90],
        },
    ];
    const activeSeries = seriesProp || defaultSeries;
    const chartOptions: ApexOptions = {
        series: activeSeries,
        colors: ["#45B369", "#FF9F29"],
        legend: { show: false },
        chart: {
            animations: { enabled: false },
            type: "bar",
            height: height, // using the prop here
            toolbar: { show: false },
        },
        grid: {
            show: true,
            borderColor: "#D1D5DB",
            strokeDashArray: 4,
            position: "back",
        },
        plotOptions: {
            bar: {
                borderRadius: 4,
                columnWidth: 8,
            },
        },
        dataLabels: { enabled: false },
        states: {
            hover: { filter: { type: "none" } },
        },
        stroke: {
            show: true,
            width: 0,
            colors: ["transparent"],
        },
        xaxis: {
            categories: categoriesProp || ["Mon", "Tues", "Wed", "Thurs", "Fri", "Sat", "Sun"],
        },
        fill: { opacity: 1 },
    };

    return (
        <div className="overflow-x-auto -mx-4 px-4 md:overflow-x-visible md:mx-0 md:px-0">
            <div className="min-w-[500px] md:min-w-0">
                <Chart
                    options={chartOptions}
                    series={activeSeries}
                    type="bar"
                    height={height} // also passed here
                />
            </div>
        </div>
    );
};

export default CoursesActivityChart;

"use client";

import { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import React from "react";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

interface CoursesActivityChartProps {
    height?: number; // optional prop, fallback if not passed
}

const CoursesActivityChart: React.FC<CoursesActivityChartProps> = ({ height = 380 }) => {
    const chartOptions: ApexOptions = {
        series: [
            {
                name: "Net Profit",
                data: [44, 100, 40, 56, 30, 58, 50],
            },
            {
                name: "Free Cash",
                data: [60, 120, 60, 90, 50, 95, 90],
            },
        ],
        colors: ["#45B369", "#FF9F29"],
        legend: { show: false },
        chart: {
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
            categories: ["Mon", "Tues", "Wed", "Thurs", "Fri", "Sat", "Sun"],
        },
        fill: { opacity: 1 },
    };

    return (
        <Chart
            options={chartOptions}
            series={chartOptions.series}
            type="bar"
            height={height} // also passed here
        />
    );
};

export default CoursesActivityChart;

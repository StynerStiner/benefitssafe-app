// @ts-nocheck
"use client";

import { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import React from "react";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

interface PendingSolvedTicketsChartProps {
    colors: [string, string];
    pendingSeries?: number[];
    solvedSeries?: number[];
}

const PendingSolvedTicketsChart: React.FC<PendingSolvedTicketsChartProps> = ({ colors, pendingSeries, solvedSeries }) => {
    const chartSeries = [
        {
            name: "Pending",
            data: pendingSeries && pendingSeries.length > 0 ? pendingSeries : [0, 0, 0, 0, 0, 0, 0, 0, 0],
        },
        {
            name: "Solved",
            data: solvedSeries && solvedSeries.length > 0 ? solvedSeries : [0, 0, 0, 0, 0, 0, 0, 0, 0],
        },
    ];

    const chartOptions: ApexOptions = {
        legend: {
            show: false,
        },
        chart: {
            animations: { enabled: false },
            type: "area",
            width: "100%",
            height: 300,
            toolbar: { show: false },
        },
        dataLabels: { enabled: false },
        stroke: {
            curve: "smooth",
            width: 3,
            colors: colors,
            lineCap: "round",
        },
        grid: {
            show: true,
            borderColor: "#D1D5DB",
            strokeDashArray: 1,
            position: "back",
            xaxis: { lines: { show: false } },
            yaxis: { lines: { show: true } },
            padding: { top: -20, right: 0, bottom: -10, left: 0 },
        },
        fill: {
            type: "gradient",
            colors: colors,
            gradient: {
                shade: "light",
                type: "vertical",
                shadeIntensity: 0.5,
                gradientToColors: [colors[0], `${colors[1]}00`],
                inverseColors: false,
                opacityFrom: [0.5, 0.5],
                opacityTo: [0.3, 0.3],
                stops: [0, 100],
            },
        },
        markers: {
            colors: colors,
            strokeWidth: 3,
            size: 0,
            hover: { size: 10 },
        },
        xaxis: {
            labels: { show: false },
            categories: [
                "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
            ],
            tooltip: { enabled: false },
        },
        tooltip: {
            x: { format: "dd/MM/yy HH:mm" },
        },
    };

    return (
        <div className="label--20-px">
            <Chart
                options={chartOptions}
                series={chartSeries}
                type="area"
                height={200}
            />
        </div>
    );
};

export default PendingSolvedTicketsChart;
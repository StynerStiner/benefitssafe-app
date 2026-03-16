"use client";

import { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

const GreenBarChart = () => {
    const chartOptions: ApexOptions = {
        colors: ['#22c55e'],
        labels: ['Active', 'New', 'Total'],
        legend: {
            show: false
        },
        chart: {
            type: 'bar',
            height: 74,
            toolbar: {
                show: false
            },
            sparkline: {
                enabled: true // Remove whitespace
            },
        },
        grid: {
            show: true,
            borderColor: '#ff000000',
            strokeDashArray: 4, // Use a number for dashed style
            position: 'back',
        },
        plotOptions: {
            bar: {
                borderRadius: 6,
                columnWidth: 16,
            },
        },
        dataLabels: {
            enabled: false
        },
        stroke: {
            show: true,
            width: 2,
            colors: ['transparent']
        },
        xaxis: {
            categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            axisBorder: {
                show: false,
            },
            axisTicks: {
                show: false,
            },
            labels: {
                show: false,
            },
        },
        yaxis: {
            axisBorder: {
                show: false,
            },
            axisTicks: {
                show: false,
            },
            labels: {
                show: false,
            },
        },
        fill: {
            opacity: 1,
        },
    };

    const chartSeries = [{
        name: 'Net Profit',
        data: [20000, 16000, 14000, 25000, 45000, 18000, 28000, 11000, 26000, 48000, 18000, 22000]
}]

return (
    <>
        <Chart
            options={chartOptions}
            series={chartSeries}
            type="bar"
            height={74}
        />
    </>
);
};

export default GreenBarChart;

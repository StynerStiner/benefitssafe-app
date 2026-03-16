"use client";

import { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

const UpdownBarChartSmall = () => {
    const chartOptions: ApexOptions = {
        chart: {
            stacked: true,
            type: "bar",
            height: 64,
            fontFamily: "Poppins, sans-serif",
            toolbar: {
                show: false,
            },
            sparkline: {
                enabled: true // Remove whitespace
            },
        },
        colors: ["#9935fe26", "#9935FE"],
        plotOptions: {
            bar: {
                columnWidth: "8",
                borderRadius: 2,
                borderRadiusWhenStacked: "all",
            },
        },
        stroke: {
            width: [5, 5]
        },
        dataLabels: {
            enabled: false,
        },
        legend: {
            show: false,
            position: "top",
        },
        yaxis: {
            show: false,
            title: {
                text: undefined,
            },
            labels: {
                formatter: function (y) {
                    return y.toFixed(0) + "";
                },
            },
        },
        xaxis: {
            categories: [
                "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun",
                "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"
            ],
            // show: false,
            axisBorder: {
                show: false,
            },
            axisTicks: {
                show: false,
            },
            labels: {
                show: false,
                style: {
                    colors: "#d4d7d9",
                    fontSize: "10px",
                    fontWeight: 500,
                },
            },
        },
        tooltip: {
            enabled: true,
            shared: true,
            intersect: false,
            theme: "dark",
            x: {
                show: false,
            },
        },
    };

    const chartSeries =  [
            {
                name: "Income",
                data: [44, 42, 57, 86, 58, 55, 70, 44, 42, 57, 86, 58, 55, 70],
            },
            {
                name: "Expenses",
                data: [-34, -22, -37, -56, -21, -35, -60, -34, -22, -37, -56, -21, -35, -60],
            },
        ]

    return (
        <>
            <Chart
                options={chartOptions}
                series={chartSeries}
                type="bar"
                height={64}
            />
        </>
    );
};

export default UpdownBarChartSmall;

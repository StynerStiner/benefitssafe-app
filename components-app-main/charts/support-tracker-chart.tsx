"use client";

import { ApexOptions } from "apexcharts";
import dynamic from 'next/dynamic';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

const SupportTrackerChart = () => {
    const chartOptions: ApexOptions = {
        series: [500, 500, 500],
        colors: ['#f0b100', '#7f22fe', '#155dfc'],
        labels: ['Active', 'New', 'Total'],
        legend: {
            show: false
        },
        chart: {
            type: 'donut',
            height: 270,
            sparkline: {
                enabled: true
            }
        },
        stroke: {
            width: 0
        },
        dataLabels: {
            enabled: false
        },
        responsive: [
            {
                breakpoint: 480,
                options: {
                    chart: {
                        width: 200
                    },
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        ]
    };

    return (
        <Chart
            options={chartOptions}
            series={chartOptions.series}
            type="donut"
            height={270}
        />
    );
};

export default SupportTrackerChart;

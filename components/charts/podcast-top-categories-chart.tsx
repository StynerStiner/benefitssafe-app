// @ts-nocheck
"use client";

import { ApexOptions } from "apexcharts";
import dynamic from 'next/dynamic';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

const PodcastTopCategoriesChart = () => {

    const chartOptions: ApexOptions = {
        series: [60, 87, 87, 30, 50],
        colors: ['#FF9F29', '#487FFF', '#e7000b', '#45B369', '#9935FE'],
        labels: ['Health', 'Business', 'Lifestyle', 'Entertainment', 'UX/UI Design'],
        legend: {
            show: false
        },
        chart: {
            animations: { enabled: false },
            type: 'donut',
            height: 300,
            sparkline: {
                enabled: true // Remove whitespace
            },
        },
        stroke: {
            width: 0,
        },
        dataLabels: {
            enabled: false
        },
        responsive: [{
            breakpoint: 480,
            options: {
                chart: {
            animations: { enabled: false },
                    width: 200
                },
                legend: {
                    position: 'bottom'
                }
            }
        }],
    };

    return (
        <div className="overflow-x-auto -mx-4 px-4 md:overflow-x-visible md:mx-0 md:px-0">
            <div className="min-w-[500px] md:min-w-0">
                <Chart
                    options={chartOptions}
                    series={chartOptions.series}
                    type="donut"
                    height={300}
                />
            </div>
        </div>
    );
};

export default PodcastTopCategoriesChart;

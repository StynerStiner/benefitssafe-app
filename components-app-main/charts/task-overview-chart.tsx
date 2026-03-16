"use client";

import { ApexOptions } from "apexcharts";
import dynamic from 'next/dynamic';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

const TaskOverviewChart = () => {

    const chartOptions: ApexOptions = {
        series: [30, 30, 20, 20],
        colors: ['#FF9F29', '#487FFF', '#ad46ff', '#e7000b'],
        labels: ['Pending', 'In Progress', 'Completed', 'Cancelled'],
        legend: {
            show: false
        },
        chart: {
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
                    width: 200
                },
                legend: {
                    position: 'bottom'
                }
            }
        }],
    };

    return (
        <Chart
            options={chartOptions}
            series={chartOptions.series}
            type="donut"
            height={300}
        />
    );
};

export default TaskOverviewChart;

// @ts-nocheck
"use client";

import { ApexOptions } from 'apexcharts';
import dynamic from 'next/dynamic';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

const ExpenseStatisticsChart = ({ series }: { series?: number[] }) => {
    const chartOptions: ApexOptions = {
        series: series || [30, 30, 30, 30],
        chart: {
            animations: { enabled: false },
            height: 240,
            type: 'pie',
        },
        labels: ['Pending', 'Approved', 'Rejected', 'Paid'],
        colors: ['#02BCAF', '#F0437D', '#1C52F6', '#43DCFF'],
        legend: {
            show: true
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
        }]
    };

    return (
        <Chart
            options={chartOptions}
            series={chartOptions.series}
            type="pie"
            height={240}
        />
    );
};

export default ExpenseStatisticsChart;

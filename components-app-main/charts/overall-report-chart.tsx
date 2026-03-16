"use client";

import { ApexOptions } from "apexcharts";
import dynamic from 'next/dynamic';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface OverallReportChartType {
    showDataLabels?: boolean;
} 

const OverallReportChart = ({showDataLabels = true} : OverallReportChartType) => {

    const chartOptions: ApexOptions = {
        series: [30, 30, 20, 20],
        colors: ['#FF9F29', '#487FFF', '#45B369', '#9935FE'],
        labels: ['Purchase', 'Sales', 'Expense', 'Gross Profit'],
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
            enabled: showDataLabels
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

export default OverallReportChart;

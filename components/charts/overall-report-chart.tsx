// @ts-nocheck
"use client";

import { ApexOptions } from "apexcharts";
import dynamic from 'next/dynamic';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface OverallReportChartType {
    showDataLabels?: boolean;
    seriesData?: number[];
    labels?: string[];
}

const OverallReportChart = ({showDataLabels = true, seriesData, labels: labelsProp} : OverallReportChartType) => {

    const series = seriesData || [30, 30, 20, 20];
    const chartOptions: ApexOptions = {
        series,
        colors: ['#FF9F29', '#487FFF', '#45B369', '#9935FE'],
        labels: labelsProp || ['Purchase', 'Sales', 'Expense', 'Gross Profit'],
        legend: {
            show: false
        },
        chart: {
            type: 'donut',
            height: 300,
            sparkline: {
                enabled: true
            },
            animations: {
                enabled: false,
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
            series={series}
            type="donut"
            height={300}
        />
    );
};

export default OverallReportChart;

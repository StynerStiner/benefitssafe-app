// @ts-nocheck
"use client";

import { ApexOptions } from "apexcharts";
import dynamic from 'next/dynamic';
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false })

const chartOptions: ApexOptions = {
        chart: {
            animations: { enabled: false },
            type: 'bar',
            height: 270,
            toolbar: {
                show: false
            },
        },
        plotOptions: {
            bar: {
                borderRadius: 4,
                horizontal: true,
                distributed: true,
                barHeight: '22px'
            }
        },
        dataLabels: {
            enabled: false
        },
        grid: {
            show: true,
            borderColor: '#ddd',
            strokeDashArray: 0,
            position: 'back',
            xaxis: {
                lines: {
                    show: false
                }
            },
            yaxis: {
                lines: {
                    show: false
                }
            },
        },
        xaxis: {
            categories: ['Allowed', 'Review Required', 'Blocked', 'Expired', 'Exempt'],
        },
        legend: {
            show: false
        },
        fill: {
            type: 'gradient',
            gradient: {
                shade: 'light',
                type: "horizontal",
                shadeIntensity: 0.5,
                gradientToColors: ['#C98BFF', '#FFDC90', '#94FF9B', '#FFAC89', '#A3E2FE'],
                inverseColors: false,
                opacityFrom: 1,
                opacityTo: 1,
                stops: [0, 100]
            }
        },
        colors: [
            '#8501F8',
            '#FF9F29',
            '#00D40E',
            '#F84B01',
            '#2FBCFC'
        ]
    };

const chartSeries = [{
    data: [6200, 5200, 4200, 3200, 1200]
}]


const StatisticBarChart = () => {
    return (
        <div className="overflow-x-auto -mx-4 px-4 md:overflow-x-visible md:mx-0 md:px-0">
            <div className="min-w-[500px] md:min-w-0">
                <Chart
                    options={chartOptions}
                    series={chartSeries}
                    type="bar"
                    height={270}
                />
            </div>
        </div>
    );
};

export default StatisticBarChart
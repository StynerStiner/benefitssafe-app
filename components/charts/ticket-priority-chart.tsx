// @ts-nocheck
"use client";

import { ApexOptions } from "apexcharts";
import dynamic from 'next/dynamic';
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false })

interface TicketPriorityChartProps {
    series?: number[];
}

const TicketPriorityChart = ({ series }: TicketPriorityChartProps) => {
    const chartData = series && series.some(v => v > 0) ? series : [0, 0, 0, 0];

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
            categories: ['Hight', 'Medium', 'Low', 'Urgent'],
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
                gradientToColors: ['#C98BFF', '#FFDC90', '#94FF9B', '#FFAC89'],
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
        data: chartData
    }];

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

export default TicketPriorityChart
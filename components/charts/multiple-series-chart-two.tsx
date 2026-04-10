// @ts-nocheck
"use client";

import { ApexOptions } from "apexcharts";
import dynamic from 'next/dynamic';
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false })

interface MultipleSeriesChartTwoProps {
    series?: number[];
}

const MultipleSeriesChartTwo = ({ series }: MultipleSeriesChartTwoProps) => {
    const chartSeries = series && series.some(v => v > 0) ? series : [0, 0, 0, 0];

    const chartOptions: ApexOptions = {
        chart: {
                animations: { enabled: false },
            type: 'polarArea',
            height: 264,
        },
        labels: ['Product 1', 'Product 2', 'Product 3', 'Product 4'],
        colors: ['#487FFF', '#FF9F29', '#9935FE', '#EF4A00'],
        stroke: {
            colors: ['#487FFF', '#FF9F29', '#9935FE', '#EF4A00'],
        },
        fill: {
            opacity: 0.8
        },
        legend: {
            show: false,
            position: 'bottom',
            horizontalAlign: 'center' // Align the legend horizontally
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
        <div className="overflow-x-auto -mx-4 px-4 md:overflow-x-visible md:mx-0 md:px-0">
            <div className="min-w-[500px] md:min-w-0">
                <div className="-m-4">
                    <Chart
                        options={chartOptions}
                        series={chartSeries}
                        type="polarArea"
                        height={264}
                    />
                </div>
            </div>
        </div>
    );
};

export default MultipleSeriesChartTwo
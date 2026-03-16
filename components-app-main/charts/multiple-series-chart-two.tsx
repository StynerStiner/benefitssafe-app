"use client";

import { ApexOptions } from "apexcharts";
import dynamic from 'next/dynamic';
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false })

const chartOptions: ApexOptions = {
    chart: {
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
                width: 200
            },
            legend: {
                position: 'bottom'
            }
        }
    }]
};

const chartSeries = [20, 22, 28, 10]

const MultipleSeriesChartTwo = () => {
    return (
        <div className="-m-4">
            <Chart
                options={chartOptions}
                series={chartSeries}
                type="polarArea"
                height={264}
            />
        </div>
    );
};

export default MultipleSeriesChartTwo
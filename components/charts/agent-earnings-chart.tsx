// @ts-nocheck
"use client";

import { ApexOptions } from "apexcharts";
import dynamic from 'next/dynamic';
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false })

const chartOptions: ApexOptions = {
    chart: {
            animations: { enabled: false },
        type: 'bar',
        height: 310,
        toolbar: {
            show: false
        }
    },
    plotOptions: {
        bar: {
            borderRadius: 7,
            horizontal: false,
            columnWidth: '23%',
        }
    },
    dataLabels: {
        enabled: false
    },
    fill: {
        type: 'gradient',
        colors: ['#487FFF'], // Set the starting color (top color) here
        gradient: {
            shade: 'light', // Gradient shading type
            type: 'vertical',  // Gradient direction (vertical)
            shadeIntensity: 0.5, // Intensity of the gradient shading
            gradientToColors: ['#487FFF'], // Bottom gradient color (with transparency)
            inverseColors: false, // Do not invert colors
            opacityFrom: 1, // Starting opacity
            opacityTo: 1,  // Ending opacity
            stops: [0, 100],
        },
    },
    grid: {
        show: true,
        borderColor: '#D1D5DB',
        strokeDashArray: 4, // Use a number for dashed style
        position: 'back',
    },
    xaxis: {
        type: 'category',
        categories: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sun']
    },
    yaxis: {
        labels: {
            formatter: function (value) {
                return String(value);
            }
        }
    },
    tooltip: {
        y: {
            formatter: function (value) {
                return String(value);
            }
        }
    }
};
const defaultChartSeries = [{
    name: "Actions",
    data: [{
        x: 'Sun',
        y: 0,
    }, {
        x: 'Mon',
        y: 0,
    }, {
        x: 'Tue',
        y: 0,
    }, {
        x: 'Wed',
        y: 0,
    }, {
        x: 'Thu',
        y: 0,
    }, {
        x: 'Fri',
        y: 0,
    }, {
        x: 'Sat',
        y: 0,
    }]
}]

interface AgentEarningsChartProps {
    series?: typeof defaultChartSeries;
}

const AgentEarningsChart = ({ series }: AgentEarningsChartProps) => {
    return (
        <div className="-m-4 mt-0">
            <Chart
                options={chartOptions}
                series={series || defaultChartSeries}
                type="bar"
                height={310}
            />
        </div>
    );
};

export default AgentEarningsChart;
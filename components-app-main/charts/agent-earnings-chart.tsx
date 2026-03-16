"use client";

import { ApexOptions } from "apexcharts";
import dynamic from 'next/dynamic';
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false })

const chartOptions: ApexOptions = {
    chart: {
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
                return (value / 1000).toFixed(0) + 'k';
            }
        }
    },
    tooltip: {
        y: {
            formatter: function (value) {
                return value / 1000 + 'k';
            }
        }
    }
};
const chartSeries = [{
    name: "Sales",
    data: [{
        x: 'Sun',
        y: 85000,
    }, {
        x: 'Mon',
        y: 70000,
    }, {
        x: 'Tue',
        y: 40000,
    }, {
        x: 'Wed',
        y: 50000,
    }, {
        x: 'Thu',
        y: 60000,
    }, {
        x: 'Fri',
        y: 50000,
    }, {
        x: 'Sun',
        y: 40000,
    }]
}]

const AgentEarningsChart = () => {
    return (
        <div className="-m-4 mt-0">
            <Chart
                options={chartOptions}
                series={chartSeries}
                type="bar"
                height={310}
            />
        </div>
    );
};

export default AgentEarningsChart;
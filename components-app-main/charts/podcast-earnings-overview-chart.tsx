"use client";

import { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

const chartSeries = [{
    name: 'series1',
    data: [6, 20, 15, 48, 28, 55, 28, 52, 25, 32, 15, 25]
}]

const chartOptions: ApexOptions = {
    legend: {
        show: false
    },
    chart: {
        type: 'area',
        width: '100%',
        height: 200,
        toolbar: {
            show: false
        },
    },
    dataLabels: {
        enabled: false
    },
    stroke: {
        curve: 'smooth',
        width: 0,
        colors: ['#98B6FF', '#6593FF'], // Use two colors for the lines
        lineCap: 'round'
    },
    grid: {
        show: true,
        borderColor: '#D1D5DB',
        strokeDashArray: 1,
        position: 'back',
        xaxis: {
            lines: {
                show: false
            }
        },
        yaxis: {
            lines: {
                show: true
            }
        },
        row: {
            colors: undefined,
            opacity: 0.5
        },
        column: {
            colors: undefined,
            opacity: 0.5
        },
        padding: {
            top: -5,
            right: 0,
            bottom: -10,
            left: 0
        },
    },
    colors: ['#98B6FF', '#6593FF'], // Set color for series
    fill: {
        type: 'gradient',
        colors: ['#98B6FF', '#6593FF'], // Use two colors for the gradient
        gradient: {
            shade: 'light',
            type: 'vertical',
            shadeIntensity: 0.5,
            gradientToColors: ['#98B6FF', '#6593FF00'], // Apply transparency to both colors
            inverseColors: false,
            opacityFrom: [1, 0.6], // Starting opacity for both colors
            opacityTo: [0.5, 0.4], // Ending opacity for both colors
            stops: [0, 100],
        },
    },
    markers: {
        colors: ['#98B6FF', '#6593FF'],
        strokeWidth: 2,
        size: 0,
        hover: {
            size: 8
        }
    },

    xaxis: {
        labels: {
            show: false
        },
        categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        tooltip: {
            enabled: false
        }
    },
    yaxis: {
        labels: {
            formatter: function (value: any) {
                return "$" + value + "k";
            },
            style: {
                fontSize: "14px"
            }
        },
    },
    tooltip: {
        x: {
            format: 'dd/MM/yy HH:mm'
        }
    }
};

const PodcastEarningsOverviewChart = () => {
    return (
        <Chart
            options={chartOptions}
            series={chartSeries}
            type="area"
            height={240}
        />
    );
};

export default PodcastEarningsOverviewChart;

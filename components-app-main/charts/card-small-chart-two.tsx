"use client";

import dynamic from 'next/dynamic'
import React from "react";
import { ApexOptions } from "apexcharts";
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false })

interface ChartColorType {
    chartColor: string;
}

const CardSmallChartTwo = ({ chartColor }: ChartColorType) => {

    let currentYear = new Date().getFullYear();
    const chartOptions: ApexOptions = {
        chart: {
            type: 'area',
            width: 130,
            height: 50,
            sparkline: {
                enabled: true // Remove whitespace
            },

            toolbar: {
                show: false
            },
        },
        dataLabels: {
            enabled: false
        },
        stroke: {
            curve: 'smooth',
            width: 2,
            colors: [chartColor],
            lineCap: 'round'
        },
        grid: {
            show: true,
            borderColor: 'transparent',
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
            row: {
                colors: undefined,
                opacity: 0.5
            },
            column: {
                colors: undefined,
                opacity: 0.5
            },
            padding: {
                top: -3,
                right: 0,
                bottom: 0,
                left: 0
            },
        },
        fill: {
            type: 'gradient',
            colors: [chartColor], // Set the starting color (top color) here
            gradient: {
                shade: 'light', // Gradient shading type
                type: 'vertical',  // Gradient direction (vertical)
                shadeIntensity: 0.5, // Intensity of the gradient shading
                gradientToColors: [`${chartColor}00`], // Bottom gradient color (with transparency)
                inverseColors: false, // Do not invert colors
                opacityFrom: .7, // Starting opacity
                opacityTo: 0.3,  // Ending opacity
                stops: [0, 100],
            },
        },
        // Customize the circle marker color on hover
        markers: {
            colors: [chartColor],
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
            categories: [`Jan ${currentYear}`, `Feb ${currentYear}`, `Mar ${currentYear}`, `Apr ${currentYear}`, `May ${currentYear}`, `Jun ${currentYear}`, `Jul ${currentYear}`, `Aug ${currentYear}`, `Sep ${currentYear}`, `Oct ${currentYear}`, `Nov ${currentYear}`, `Dec ${currentYear}`],
            tooltip: {
                enabled: false,
            },
        },
        yaxis: {
            labels: {
                show: false
            }
        },
        tooltip: {
            x: {
                format: 'dd/MM/yy HH:mm'
            },
        },
    };

    const chartSeries = [
        {
            name: 'series1',
            data: [31, 24, 30, 25, 32, 28, 40, 32, 42, 38, 40, 32, 38, 35, 45],
        },
    ]


    return (
        <Chart
            options={chartOptions}
            series={chartSeries}
            type="area"
            height={60}
            width={130}
        />
    );
};

export default CardSmallChartTwo;
"use client";

import { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import React from "react";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

interface TimeCompletionChartProps {
    colors: [string, string];
}

const chartSeries = [{
    name: 'series1',
    data: [48, 35, 55, 32, 48, 30, 55, 50, 57]
}]

const TimeCompletionChart: React.FC<TimeCompletionChartProps> = ({ colors }) => {
    const chartOptions: ApexOptions =  {
            legend: {
                show: false 
            },
            chart: {
                type: 'area',
                width: 466,
                height: 86,
                toolbar: {
                    show: false
                },
                dropShadow: {
                    enabled: false // Removes shadow
                }
            },
            dataLabels: {
                enabled: false
            },
            stroke: {
                curve: 'smooth',
                width: 3,
                colors: colors // Use solid colors for the lines
            },
            fill: {
                type: "solid", 
                opacity: 0 // No gradient or shadow fill
            },
            grid: {
                show: false
            },
            markers: {
                colors: colors, // Use two colors for the markers
                strokeWidth: 3,
                size: 0,
                hover: {
                    size: 10
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
                    show: false
                }
            },
            tooltip: {
                x: {
                    format: 'dd/MM/yy HH:mm'
                }
            }
        };

    return (
        <div className="label--20-px">
            <Chart
                options={chartOptions}
                series={chartSeries}
                type="area"
                height={100}
            />
        </div>
    );
};

export default TimeCompletionChart;
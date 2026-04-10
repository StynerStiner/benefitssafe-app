// @ts-nocheck
"use client";

import dynamic from 'next/dynamic'
import React from "react";
import { ApexOptions } from "apexcharts";
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false })

const chartOptions: ApexOptions = {
    series: [80, 40, 10],
    chart: {
            animations: { enabled: false },
        height: 300,
        type: 'radialBar',
    },
    colors: ['#3D7FF9', '#ff9f29', '#16a34a'],
    stroke: {
        lineCap: 'round',
    },
    plotOptions: {
        radialBar: {
            hollow: {
                size: '10%',  // Adjust this value to control the bar width
            },
            dataLabels: {
                name: {
                    fontSize: '16px',
                },
                value: {
                    fontSize: '16px',
                },
            },
            track: {
                margin: 20, // Space between the bars
            }
        }
    },
    labels: ['Cardiology', 'Psychiatry', 'Pediatrics'],
};

const chartSeries = [80, 40, 10]


const RadialMultipleBar = () => {
    return (
        <div className="overflow-x-auto -mx-4 px-4 md:overflow-x-visible md:mx-0 md:px-0">
            <div className="min-w-[500px] md:min-w-0">
                <div className="-m-4">
                    <Chart
                        options={chartOptions}
                        series={chartSeries}
                        type="radialBar"
                        height={300}
                    />
                </div>
            </div>
        </div>
    );
};

export default RadialMultipleBar
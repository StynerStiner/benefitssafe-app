"use client";

import { ApexOptions } from "apexcharts";
import dynamic from 'next/dynamic';
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false })

interface ChartColorType {
    color1?: string;
    color2?: string;
    chartHeight?: number;
}

const AreaStepline = ({ color1 = "#16a34a", color2 = "#FF9F29", chartHeight = 340 }: ChartColorType) => {
    const chartOptions: ApexOptions = {
        legend: {
            show: false
        },
        chart: {
            type: 'area',
            width: '100%',
            height: chartHeight,
            toolbar: {
                show: false
            },
        },
        dataLabels: {
            enabled: false
        },
        stroke: {
            curve: 'stepline',
            width: 2,
            colors: [color1, color2],
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
                opacity: 0.2
            },
            column: {
                colors: undefined,
                opacity: 0.2
            },
            padding: {
                top: -20,
                right: 0,
                bottom: -10,
                left: 0
            },
        },
        colors: [color1, color2],
        markers: {
            colors: [color1, color2],
            strokeWidth: 1,
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
                formatter: function (value) {
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

    const chartSeries = [{
        name: 'Income',
        data: [48, 35, 55, 32, 48, 30, 55, 50, 57]
    }, {
        name: 'Expense',
        data: [12, 20, 15, 26, 22, 60, 40, 48, 25]
    }]

    return (
        <Chart
            options={chartOptions}
            series={chartSeries}
            type="area"
            height={chartHeight}
        />
    );
};

export default AreaStepline;
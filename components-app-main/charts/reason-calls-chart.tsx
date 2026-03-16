"use client";

import { ApexOptions } from "apexcharts";
import dynamic from 'next/dynamic';
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false })

const chartOptions: ApexOptions = {
        chart: {
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
            categories: ['Service Problems', 'Technical Issues', 'Payment Issue', 'New Customer', 'Product Problems'],
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
                gradientToColors: ['#C98BFF', '#FFDC90', '#94FF9B', '#FFAC89', '#89C0FF'],
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
            '#2FBCFC',
            '#1101F8'
        ]
    };

const chartSeries = [{
    data: [10, 8, 6, 4, 2]
}]

const ReasonCallsChart = () => {
    return (
        <div className="-mt-[54px]">
            <Chart
                options={chartOptions}
                series={chartSeries}
                type="bar"
                height={470}
            />
        </div>
    );
};

export default ReasonCallsChart
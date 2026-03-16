"use client";

import { ApexOptions } from 'apexcharts';
import dynamic from 'next/dynamic';
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false })

const AudienceStatsChart = () => {
    // const chartSeries: ApexAxisChartSeries = [{
    //     name: "Sales",
    //     data: [{
    //         x: 'Sun',
    //         y: 15,
    //     }, {
    //         x: 'Mon',
    //         y: 12,
    //     }, {
    //         x: 'Tue',
    //         y: 18,
    //     }, {
    //         x: 'Wed',
    //         y: 20,
    //     }, {
    //         x: 'Thu',
    //         y: 13,
    //     }, {
    //         x: 'Fri',
    //         y: 16,
    //     }, {
    //         x: 'Sat',
    //         y: 6,
    //     }]
    // }]

    // const chartOptions: ApexOptions = {
    //     chart: {
    //         type: 'bar',
    //         height: 235,
    //         toolbar: {
    //             show: false
    //         },
    //     },
    //     plotOptions: {
    //         bar: {
    //             borderRadius: 6,
    //             horizontal: false,
    //             columnWidth: '52%',
    //         }
    //     },
    //     dataLabels: {
    //         enabled: false
    //     },
    //     fill: {
    //         type: 'gradient',
    //         colors: ['#dae5ff'], // Set the starting color (top color) here
    //         gradient: {
    //             shade: 'light', // Gradient shading type
    //             type: 'vertical',  // Gradient direction (vertical)
    //             shadeIntensity: 0.5, // Intensity of the gradient shading
    //             gradientToColors: ['#dae5ff'], // Bottom gradient color (with transparency)
    //             inverseColors: false, // Do not invert colors
    //             opacityFrom: 1, // Starting opacity
    //             opacityTo: 1,  // Ending opacity
    //             stops: [0, 100],
    //         },
    //     },
    //     grid: {
    //         show: false,
    //         borderColor: '#D1D5DB',
    //         strokeDashArray: 4, // Use a number for dashed style
    //         position: 'back',
    //         padding: {
    //             top: -10,
    //             right: -10,
    //             bottom: -10,
    //             left: -10
    //         }
    //     },
    //     xaxis: {
    //         type: 'category',
    //         categories: ['2hr', '4hr', '6hr', '8hr', '10hr', '12hr', '14hr']
    //     },
    //     yaxis: {
    //         show: false,
    //     },
    // };


    const chartSeries: ApexAxisChartSeries = [{
            name: 'Net Profit',
            data: [44, 100, 40, 56, 30, 58, 50, 44, 100, 40, 56, 30]
        }, {
            name: 'Revenue',
            data: [90, 140, 80, 125, 70, 140, 110, 90, 140, 80, 125, 70]
        }, {
            name: 'Free Cash',
            data: [60, 120, 60, 90, 50, 95, 90, 60, 120, 60, 90, 50]
        }]
    
    
    const chartOptions: ApexOptions = {
        colors: ['#E4F1FF', '#E4F1FF', '#E4F1FF'],
        labels: ['Active', 'New', 'Total'],

        legend: {
            show: false
        },
        chart: {
            type: 'bar',
            height: 300,
            toolbar: {
                show: false
            },
        },
        grid: {
            show: true,
            borderColor: '#00000000',
            strokeDashArray: 4, // Use a number for dashed style
            position: 'back',
        },
        plotOptions: {
            bar: {
                borderRadius: 2,
                columnWidth: '70%',
                borderRadiusApplication: 'end'
            },
        },
        dataLabels: {
            enabled: false
        },
        states: {
            hover: {
                filter: {
                    type: 'none'
                }
            }
        },
        stroke: {
            show: true,
            width: 4,
            colors: ['transparent']
        },
        xaxis: {
            categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        },
        yaxis: {
            labels: {
                formatter: function (value:any) {
                    return "$" + value + "k";
                },
                style: {
                    fontSize: "14px"
                }
            },
        },
    };

    return (
        <Chart
            options={chartOptions}
            series={chartSeries}
            type="bar"
            height={280}
        />
    );
};

export default AudienceStatsChart;
"use client";

import dynamic from 'next/dynamic'
import React from "react";
import { ApexOptions } from "apexcharts";
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false })

const chartOptions:ApexOptions = {
    colors: ['#45B369', '#144bd6', '#FF9F29'],
    labels: ['Active', 'New', 'Total'] ,
    
    legend: {
        show: false 
    },
    chart: {
      type: 'bar',
      height: 350,
      toolbar: {
        show: false
      },
    },
    grid: {
        show: true,
        borderColor: '#D1D5DB',
        strokeDashArray: 4, // Use a number for dashed style
        position: 'back',
    },
    plotOptions: {
      bar: {
        borderRadius: 4,
        columnWidth: 8,
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
      width: 0,
      colors: ['transparent']
    },
    xaxis: {
      categories: ['Mon', 'Tues', 'Wed', 'Thurs', 'Fri', 'Sat', 'Sun'],
    },
    fill: {
      opacity: 1,
    },
};

const chartSeries = [{
    name: 'Net Profit',
    data: [44, 100, 40, 56, 30, 58, 50]
  }, {
    name: 'Revenue',
    data: [90, 140, 80, 125, 70, 140, 110]
  }, {
    name: 'Free Cash',
    data: [60, 120, 60, 90, 50, 95, 90]
  }]


const ClientPaymentStatusChart = () => {
    return (
        <div className="-m-4">
            <Chart
                options={chartOptions}
                series={chartSeries}
                type="bar" 
                height={370}
            />
        </div>
    );
};

export default ClientPaymentStatusChart;
"use client";

import dynamic from 'next/dynamic'
import React from "react";
import { ApexOptions } from "apexcharts";
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false })

const chartOptions: ApexOptions = {
  colors: ['#45B369', '#FF9F29', '#487FFF'],
  labels: ['Active', 'New', 'Total'],
  legend: {
    show: false
  },
  chart: {
    type: 'donut',
    height: 300,
    sparkline: {
      enabled: true // Remove whitespace
    },
  },
  stroke: {
    width: 0,
  },
  dataLabels: {
    enabled: false
  },
  responsive: [{
    breakpoint: 480,
    options: {
      chart: {
        width: 200
      },
      legend: {
        position: 'bottom'
      }
    }
  }],
  plotOptions: {
    pie: {
      startAngle: -90,
      endAngle: 90,
      offsetY: 10,
      customScale: 0.8,
      donut: {
        size: '70%',
        labels: {
          show: true,
          total: {
            showAlways: true,
            show: true,
            label: 'Customer Report',
          }
        },
      }
    }
  },
};

const chartSeries = [500, 500, 500]

const CustomerOverviewChart = () => {
  return (
    <Chart
      options={chartOptions}
      series={chartSeries}
      type="donut"
      height={300}
    />
  );
};

export default CustomerOverviewChart;
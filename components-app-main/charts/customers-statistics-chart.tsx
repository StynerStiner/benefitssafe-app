"use client";

import { ApexOptions } from "apexcharts";
import dynamic from 'next/dynamic';
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false })

const chartOptions: ApexOptions = {
  colors: ['#FF9F29', '#487FFF'],
  labels: ['Female', 'Male'],
  legend: {
    show: false
  },
  chart: {
    type: 'donut',
    height: 230,
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
};
const chartSeries = [30, 25]

const CustomersStatisticsChart = () => {
  return (
    <Chart
      options={chartOptions}
      series={chartSeries}
      type="donut"
      height={230}
    />
  );
};

export default CustomersStatisticsChart;
// @ts-nocheck
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
            animations: { enabled: false },
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
            animations: { enabled: false },
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
    <div className="overflow-x-auto -mx-4 px-4 md:overflow-x-visible md:mx-0 md:px-0">
      <div className="min-w-[500px] md:min-w-0">
        <Chart
          options={chartOptions}
          series={chartSeries}
          type="donut"
          height={230}
        />
      </div>
    </div>
  );
};

export default CustomersStatisticsChart;
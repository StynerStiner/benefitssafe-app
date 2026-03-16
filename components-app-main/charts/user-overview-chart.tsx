"use client";

import { ApexOptions } from "apexcharts";
import dynamic from 'next/dynamic';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

const UserOverviewChart = () => {
  const chartOptions: ApexOptions = {
    series: [500, 500, 500],
    colors: ['#FF9F29', '#487FFF', '#E4F1FF'],
    labels: ['Active', 'New', 'Total'],
    legend: {
      show: false
    },
    chart: {
      type: 'donut',
      height: 270,
      sparkline: {
        enabled: true
      }
    },
    stroke: {
      width: 0
    },
    dataLabels: {
      enabled: false
    },
    responsive: [
      {
        breakpoint: 480,
        options: {
          chart: {
            width: 200
          },
          legend: {
            position: 'bottom'
          }
        }
      }
    ]
  };

  return (
    <Chart
      options={chartOptions}
      series={chartOptions.series}
      type="donut"
      height={270}
    />
  );
};

export default UserOverviewChart;

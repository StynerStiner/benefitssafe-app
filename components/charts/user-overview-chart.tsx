// @ts-nocheck
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
            animations: { enabled: false },
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
            animations: { enabled: false },
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
    <div className="overflow-x-auto -mx-4 px-4 md:overflow-x-visible md:mx-0 md:px-0">
      <div className="min-w-[500px] md:min-w-0">
        <Chart
          options={chartOptions}
          series={chartOptions.series}
          type="donut"
          height={270}
        />
      </div>
    </div>
  );
};

export default UserOverviewChart;

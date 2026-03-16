"use client";

import dynamic from 'next/dynamic';
import React from 'react';
import { ApexOptions } from 'apexcharts';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

const GenerateContentChart = () => {
  const chartOptions: ApexOptions = {
    series: [
      {
        name: 'Net Profit',
        data: [20000, 16000, 14000, 25000, 45000, 18000, 28000, 11000, 26000, 48000, 18000, 22000],
      },
      {
        name: 'Revenue',
        data: [15000, 18000, 19000, 20000, 35000, 20000, 18000, 13000, 18000, 38000, 14000, 16000],
      },
    ],
    chart: {
      type: 'bar',
      height: 250,
      toolbar: {
        show: false,
      },
    },
    colors: ['#487FFF', '#FF9F29'],
    legend: {
      show: false,
    },
    grid: {
      show: true,
      borderColor: '#D1D5DB',
      strokeDashArray: 4,
      position: 'back',
    },
    plotOptions: {
      bar: {
        borderRadius: 4,
        columnWidth: 10,
      },
    },
    dataLabels: {
      enabled: false,
    },
    stroke: {
      show: true,
      width: 2,
      colors: ['transparent'],
    },
    xaxis: {
      categories: [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
      ],
    },
    fill: {
      opacity: 1,
    },
  };

  return (
    <Chart
      options={chartOptions}
      series={chartOptions.series}
      type="bar"
      height={254}
    />
  );
};

export default GenerateContentChart;

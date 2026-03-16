"use client";

import dynamic from "next/dynamic";
import React from "react";
import { ApexOptions } from "apexcharts";
const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

const chartOptions: ApexOptions = {
  chart: {
    height: 165,
    width: 120,
    type: "radialBar",
    sparkline: {
      enabled: false,
    },
    toolbar: {
      show: false,
    },
  },
  plotOptions: {
    radialBar: {
      offsetY: -24,
      offsetX: -14,
      startAngle: -90,
      endAngle: 90,
      track: {
        background: "#E3E6E9",
        dropShadow: {
          enabled: false,
          top: 2,
          left: 0,
          color: "#999",
          opacity: 1,
          blur: 2,
        },
      },
      dataLabels: {
        show: false,
        name: {
          show: false,
        },
        value: {
          offsetY: -2,
          fontSize: "22px",
        },
      },
    },
  },
  fill: {
    type: "gradient",
    colors: ["#9DBAFF"],
    gradient: {
      shade: "dark",
      type: "horizontal",
      shadeIntensity: 0.5,
      gradientToColors: ["#487FFF"],
      inverseColors: true,
      opacityFrom: 1,
      opacityTo: 1,
      stops: [0, 100],
    },
  },
  stroke: {
    lineCap: "round",
  },
  labels: ["Percent"],
};
const chartSeries = [75];

const DailyConversionsChart = () => {
  return (
    <Chart
      options={chartOptions}
      series={chartSeries}
      type="radialBar"
      height={165}
    />
  );
};

export default DailyConversionsChart;

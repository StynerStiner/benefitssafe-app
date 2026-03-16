"use client";

import dynamic from "next/dynamic";
import React from "react";
import { ApexOptions } from "apexcharts";
const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

const chartOptions: ApexOptions = {
  chart: {
    type: "bar",
    width: 164,
    height: 80,
    sparkline: {
      enabled: true, // Remove whitespace
    },
    toolbar: {
      show: false,
    },
  },
  plotOptions: {
    bar: {
      borderRadius: 6,
      horizontal: false,
      columnWidth: 14,
    },
  },
  dataLabels: {
    enabled: false,
  },
  states: {
    hover: {
      filter: {
        type: "none",
      },
    },
  },
  fill: {
    type: "gradient",
    colors: ["#E3E6E9"], // Set the starting color (top color) here
    gradient: {
      shade: "light", // Gradient shading type
      type: "vertical", // Gradient direction (vertical)
      shadeIntensity: 0.5, // Intensity of the gradient shading
      gradientToColors: ["#E3E6E9"], // Bottom gradient color (with transparency)
      inverseColors: false, // Do not invert colors
      opacityFrom: 1, // Starting opacity
      opacityTo: 1, // Ending opacity
      stops: [0, 100],
    },
  },
  grid: {
    show: false,
    borderColor: "#D1D5DB",
    strokeDashArray: 1, // Use a number for dashed style
    position: "back",
  },
  xaxis: {
    labels: {
      show: false, // Hide y-axis labels
    },
    type: "category",
    categories: ["Mon", "Tue", "Wed", "Thur", "Fri", "Sat"],
  },
  yaxis: {
    labels: {
      show: false,
    },
  },
};
const chartSeries = [
  {
    name: "Sales",
    data: [
      {
        x: "Mon",
        y: 20,
      },
      {
        x: "Tue",
        y: 40,
      },
      {
        x: "Wed",
        y: 20,
      },
      {
        x: "Thur",
        y: 30,
      },
      {
        x: "Fri",
        y: 40,
      },
      {
        x: "Sat",
        y: 35,
      },
    ],
  },
];

const TodayIncomeChart = () => {
  return (
    <Chart
      options={chartOptions}
      series={chartSeries}
      type="bar"
      height={80}
      width={164}
    />
  );
};

export default TodayIncomeChart;

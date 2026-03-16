"use client";

import React from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
} from "react-simple-maps";

// GeoJSON source
const geoUrl =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// Define a minimal type for a single geo object
interface GeoFeature {
  rsmKey: string;
  properties: Record<string, any>;
  geometry: {
    type: string;
    coordinates: any;
  };
};

interface WorldMapChartProps {
  mapHeight: number;
}

const WorldMapChart: React.FC<WorldMapChartProps> = ({ mapHeight }) => {
  return (
    <div className="w-full flex justify-center">
      <ComposableMap
        projection="geoMercator"
        width={800}
        height={mapHeight}
        className="w-full h-auto"
      >
        <Geographies geography={geoUrl}>
          {({ geographies }: { geographies: GeoFeature[] }) =>
            geographies.map((geo) => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                style={{
                  default: {
                    fill: "#E0E0E0",
                    outline: "none",
                  },
                  hover: {
                    fill: "#6366f1",
                    outline: "none",
                  },
                  pressed: {
                    fill: "#4f46e5",
                    outline: "none",
                  },
                }}
              />
            ))
          }
        </Geographies>
      </ComposableMap>
    </div>
  );
};

export default WorldMapChart;

// @ts-nocheck
"use client";

import React from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
} from "react-simple-maps";

// GeoJSON source — self-hosted from /public (PDR T4).
// Vendored from: https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json
// SHA-256:  2516c915867c7baf18ddec727aec46c315541a07cfb3d79a6559b05d5e94eee8
// Size:     107761 bytes
// Captured: 2026-04-23
// NOTE: world-atlas@2 is a mutable npm version tag, not an immutable hash.
// A maintainer republish of v2 would drift silently. Re-verify upstream
// SHA-256 against this capture quarterly.
// TODO: re-verify upstream SHA — next check due 2026-07-22
const geoUrl = "/maps/countries-110m.json";

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

'use client';

import Image from "next/image";
import { useEffect, useState } from "react";

import FlagImg1 from "@/public/assets/images/flags/flag1.png";
import FlagImg2 from "@/public/assets/images/flags/flag2.png";
import FlagImg3 from "@/public/assets/images/flags/flag3.png";
import FlagImg4 from "@/public/assets/images/flags/flag4.png";

export interface StateData {
  name: string;
  count: number;
}

interface CountryListProps {
  data?: StateData[];
}

const stateFlags: Record<string, any> = {
  "California": FlagImg1,
  "New York": FlagImg2,
  "Texas": FlagImg3,
  "default": FlagImg4,
};

const stateColors: Record<string, string> = {
  "California": "bg-primary",
  "New York": "bg-[#f86624]",
  "Texas": "bg-yellow-500",
  "default": "bg-green-600",
};

const CountryList = ({ data }: CountryListProps) => {
  const [stateData, setStateData] = useState<StateData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If data is provided, use it
    if (data && data.length > 0) {
      setStateData(data);
      setLoading(false);
      return;
    }

    // Otherwise fetch from API
    fetch("/api/beneficiaries/by-state")
      .then((res) => res.ok ? res.json() : { states: [] })
      .then((result) => {
        const states = Array.isArray(result) ? result : (result?.states || []);
        setStateData(states);
      })
      .catch(() => setStateData([]))
      .finally(() => setLoading(false));
  }, [data]);

  if (loading) {
    return (
      <>
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse flex items-center justify-between gap-3 mb-3 pb-2">
            <div className="flex items-center flex-1">
              <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-full me-4"></div>
              <div className="flex-1">
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-20 mb-1"></div>
              </div>
            </div>
          </div>
        ))}
      </>
    );
  }

  if (stateData.length === 0) {
    return (
      <div className="text-center text-neutral-500 text-sm py-4">
        No beneficiary data available
      </div>
    );
  }

  // Calculate totals for percentage
  const total = stateData.reduce((sum, s) => sum + s.count, 0);

  return (
    <>
      {stateData.map((state, index) => {
        const percent = total > 0 ? Math.round((state.count / total) * 100) : 0;
        const flag = stateFlags[state.name] || stateFlags.default;
        const color = stateColors[state.name] || stateColors.default;

        return (
          <div
            key={index}
            className="flex items-center justify-between gap-3 mb-3 pb-2 last:mb-0 last:pb-0"
          >
            <div className="flex items-center">
              <Image
                src={flag}
                alt={state.name}
                className="w-10 h-10 rounded-full shrink-0 me-4"
              />
              <div className="grow">
                <h6 className="text-sm mb-0">{state.name}</h6>
                <span className="text-xs text-neutral-500 dark:text-neutral-300 font-medium">
                  {state.count} {state.count === 1 ? "Beneficiary" : "Beneficiaries"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-[66px] ms-auto">
                <div className="rounded-full h-2 bg-gray-200 dark:bg-neutral-700">
                  <div
                    className={`${color} h-2 rounded-full`}
                    style={{ width: `${percent}%` }}
                  ></div>
                </div>
              </div>
              <span className="text-neutral-500 dark:text-neutral-300 text-xs font-semibold">
                {percent}%
              </span>
            </div>
          </div>
        );
      })}
    </>
  );
};

export default CountryList;

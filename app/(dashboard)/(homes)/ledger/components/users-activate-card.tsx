"use client";

import { useState } from "react";
import CustomersStatisticsChart from "@/components/charts/customers-statistics-chart";
import CustomSelect from "@/components/shared/custom-select";
import { Card, CardContent } from "@/components/ui/card";

interface GrantData {
  id: string;
  name: string;
  totalAmount: string;
  spentAmount: string;
  remainingAmount: string;
  createdAt: string;
}

function filterByPeriod<T extends { createdAt: string }>(items: T[], period: string): T[] {
  const now = new Date();
  return items.filter(item => {
    const date = new Date(item.createdAt);
    switch (period) {
      case "Today": return date.toDateString() === now.toDateString();
      case "Weekly": return now.getTime() - date.getTime() < 7 * 24 * 60 * 60 * 1000;
      case "Monthly": return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      case "Yearly": return date.getFullYear() === now.getFullYear();
      default: return true;
    }
  });
}

const UsersActivateCard = ({ grants }: { grants: GrantData[] }) => {
  const [period, setPeriod] = useState("Yearly");
  const filtered = filterByPeriod(grants, period);
  const totalCredits = filtered.reduce((sum, g) => sum + parseFloat(g.totalAmount || "0"), 0);
  const totalDebits = filtered.reduce((sum, g) => sum + parseFloat(g.spentAmount || "0"), 0);
  const netPct = totalCredits > 0 ? Math.round(((totalCredits - totalDebits) / totalCredits) * 100) : 0;
  const formattedCredits = totalCredits.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 });
  const formattedDebits = totalDebits.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 });
  return (
    <Card className="card h-full rounded-lg border-0">
      <CardContent className="card-body p-0">
        <div className="flex items-center flex-wrap gap-2 justify-between">
          <h3 className="mb-0 font-bold text-lg">Grant Activity</h3>
          <CustomSelect
            placeholder="Yearly"
            options={["Yearly", "Monthly", "Weekly", "Today"]}
            value={period}
            onValueChange={setPeriod}
          />
        </div>

        <div className="relative">
          <span className="w-[80px] h-[80px] bg-white dark:bg-slate-700 shadow-lg text-neutral-600 dark:text-neutral-200 font-semibold text-xl flex justify-center items-center rounded-full absolute end-0 top-0 z-1 me-11 mt-6">
            +{netPct}%
          </span>
          <div className="mt-9 grow apexcharts-tooltip-z-none title-style circle-none">
            <CustomersStatisticsChart />
          </div>
          <span className="w-[80px] h-[80px] bg-white dark:bg-slate-700 shadow-lg text-neutral-600 dark:text-neutral-200 font-semibold text-xl flex justify-center items-center rounded-full absolute start-0 bottom-0 z-1 mb-6 ms-14">
            Net
          </span>
        </div>

        <ul className="flex flex-wrap items-center justify-between mt-4 gap-3">
          <li className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-xs bg-blue-500"></span>
            <span className="text-neutral-500 dark:text-neutral-300 text-sm font-normal">
              Credits:
              <span className="text-neutral-600 dark:text-neutral-200 font-bold">
                {formattedCredits}
              </span>
            </span>
          </li>
          <li className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-xs bg-yellow-500"></span>
            <span className="text-neutral-500 dark:text-neutral-300 text-sm font-normal">
              Debits:
              <span className="text-neutral-600 dark:text-neutral-200 font-bold">
                {formattedDebits}
              </span>
            </span>
          </li>
        </ul>
      </CardContent>
    </Card>
  );
};

export default UsersActivateCard;

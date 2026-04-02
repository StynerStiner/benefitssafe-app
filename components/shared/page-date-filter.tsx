"use client";

import MonthYearPicker from "@/components/shared/month-year-picker";
import { cn } from "@/lib/utils";

interface PageDateFilterProps {
  selectedMonth: number;
  selectedYear: number;
  onChange: (month: number, year: number) => void;
  className?: string;
}

export default function PageDateFilter({ selectedMonth, selectedYear, onChange, className }: PageDateFilterProps) {
  return (
    <div className={cn("flex items-center justify-end", className)}>
      <MonthYearPicker
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        onChange={onChange}
      />
    </div>
  );
}

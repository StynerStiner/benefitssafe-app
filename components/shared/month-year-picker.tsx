"use client";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

interface MonthYearPickerProps {
  selectedMonth: number;
  selectedYear: number;
  onChange: (month: number, year: number) => void;
  className?: string;
}

export default function MonthYearPicker({ selectedMonth, selectedYear, onChange, className }: MonthYearPickerProps) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(selectedYear);

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const handleMonthClick = (monthIndex: number) => {
    onChange(monthIndex, viewYear);
    setOpen(false);
  };

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) setViewYear(selectedYear);
  };

  const isFutureMonth = (monthIndex: number) => {
    return viewYear > currentYear || (viewYear === currentYear && monthIndex > currentMonth);
  };

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-9 px-3 text-sm font-medium gap-2 border-neutral-200 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-neutral-50 dark:hover:bg-slate-700 shadow-sm transition-colors",
            className
          )}
        >
          <CalendarDays className="w-4 h-4 text-primary" />
          <span className="text-neutral-700 dark:text-neutral-200">
            {MONTH_FULL[selectedMonth]} {selectedYear}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="end">
        <div className="border-b border-neutral-100 dark:border-slate-600 px-4 py-3">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-neutral-100 dark:hover:bg-slate-700"
              onClick={() => setViewYear(v => v - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold text-foreground tabular-nums">{viewYear}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-neutral-100 dark:hover:bg-slate-700"
              onClick={() => setViewYear(v => v + 1)}
              disabled={viewYear >= currentYear}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="p-3">
          <div className="grid grid-cols-3 gap-1.5">
            {MONTH_NAMES.map((name, index) => {
              const isSelected = index === selectedMonth && viewYear === selectedYear;
              const isCurrent = index === currentMonth && viewYear === currentYear;
              const isFuture = isFutureMonth(index);

              return (
                <Button
                  key={name}
                  variant={isSelected ? "default" : "ghost"}
                  size="sm"
                  disabled={isFuture}
                  className={cn(
                    "h-9 text-sm font-medium transition-colors relative",
                    isSelected && "bg-primary text-primary-foreground shadow-sm",
                    !isSelected && !isFuture && "hover:bg-neutral-100 dark:hover:bg-slate-700 text-neutral-700 dark:text-neutral-300",
                    isCurrent && !isSelected && "ring-1 ring-primary/40 text-primary font-semibold",
                    isFuture && "text-neutral-300 dark:text-neutral-600"
                  )}
                  onClick={() => handleMonthClick(index)}
                >
                  {name}
                </Button>
              );
            })}
          </div>
        </div>
        <div className="border-t border-neutral-100 dark:border-slate-600 px-4 py-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-primary hover:text-primary hover:bg-primary/5 font-medium"
            onClick={() => {
              onChange(currentMonth, currentYear);
              setOpen(false);
            }}
          >
            Go to current month
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

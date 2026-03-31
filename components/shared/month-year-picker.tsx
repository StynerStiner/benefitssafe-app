"use client";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

interface MonthYearPickerProps {
  selectedMonth: number;
  selectedYear: number;
  onChange: (month: number, year: number) => void;
}

export default function MonthYearPicker({ selectedMonth, selectedYear, onChange }: MonthYearPickerProps) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(selectedYear);

  const handleMonthClick = (monthIndex: number) => {
    onChange(monthIndex, viewYear);
    setOpen(false);
  };

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) setViewYear(selectedYear);
  };

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-9 px-3 text-sm font-medium gap-2"
        >
          <CalendarDays className="w-4 h-4" />
          {MONTH_FULL[selectedMonth]} {selectedYear}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-4" align="end">
        <div className="flex items-center justify-between mb-4">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setViewYear(v => v - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold text-foreground">{viewYear}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setViewYear(v => v + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {MONTH_NAMES.map((name, index) => {
            const isSelected = index === selectedMonth && viewYear === selectedYear;
            return (
              <Button
                key={name}
                variant={isSelected ? "default" : "outline"}
                size="sm"
                className="h-9 text-sm"
                onClick={() => handleMonthClick(index)}
              >
                {name}
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

"use client";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format, parse } from "date-fns";
import { CalendarDays } from "lucide-react";
import { useState } from "react";

interface FormDatePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
}

export default function FormDatePicker({
  value,
  onChange,
  placeholder = "Select date",
  className,
  disabled,
  id,
}: FormDatePickerProps) {
  const [open, setOpen] = useState(false);

  const dateValue = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined;
  const isValidDate = dateValue && !isNaN(dateValue.getTime());

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      const formatted = format(date, "yyyy-MM-dd");
      onChange(formatted);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "border border-neutral-300 px-5 dark:border-slate-500 focus:border-primary dark:focus:border-primary focus-visible:border-primary h-12 rounded-lg !shadow-none !ring-0 w-full justify-between text-left font-normal hover:bg-transparent",
            !isValidDate && "text-muted-foreground",
            className
          )}
        >
          <span className={cn(!isValidDate && "text-neutral-400")}>
            {isValidDate ? format(dateValue, "MMMM d, yyyy") : placeholder}
          </span>
          <CalendarDays className="h-4 w-4 text-neutral-500" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={isValidDate ? dateValue : undefined}
          onSelect={handleSelect}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

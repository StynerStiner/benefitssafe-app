"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const BuyBalanceContent = () => {
  return (
    <div className="space-y-5">
      <div className="">
        <Label
          htmlFor="estimatedValue"
          className="font-semibold mb-2 block text-neutral-600 dark:text-white"
        >
          Filter by Grant
        </Label>
        <div className="flex">
          <Input
            id="estimatedValue"
            placeholder="Select grant..."
            className="border border-neutral-200 dark:border-slate-700 focus:border-primary dark:focus:border-primary focus-visible:border-primary h-11 rounded-s-lg rounded-e-none !shadow-none !ring-0"
          />
          <div className="shrink-0 flex -ms-[0px]">
            <Select>
              <SelectTrigger className="border border-s-0 border-neutral-200 dark:border-slate-700 bg-transparent px-1 text-sm dark:text-white focus:ring-0 focus:ring-offset-0 !h-full rounded-e-lg rounded-s-none">
                <SelectValue placeholder="All Grants" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-neutral-700">
                <SelectItem value="all">All Grants</SelectItem>
                <SelectItem value="writing">Writing</SelectItem>
                <SelectItem value="digital">Digital</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      <div className="">
        <Label
          htmlFor="TradeValue"
          className="font-semibold mb-2 block text-neutral-600 dark:text-white"
        >
          Date Range
        </Label>
        <div className="flex">
          <Input
            id="TradeValue"
            placeholder="Start Date"
            className="border border-neutral-200 dark:border-slate-700 focus:border-primary dark:focus:border-primary focus-visible:border-primary h-11 rounded-s-lg rounded-e-none !shadow-none !ring-0"
          />
          <div className="shrink-0 flex -ms-[0px]">
            <Select>
              <SelectTrigger className="border border-s-0 border-neutral-200 dark:border-slate-700 bg-transparent px-1 text-sm dark:text-white focus:ring-0 focus:ring-offset-0 !h-full rounded-e-lg rounded-s-none">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-neutral-700">
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="30d">30 Days</SelectItem>
                <SelectItem value="90d">90 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Address Textarea */}
      <div className="mb-5">
        <Label
          htmlFor="address"
          className="font-semibold mb-2 block text-neutral-600 dark:text-white"
        >
          Date Range
        </Label>
        <Textarea
          id="address"
          placeholder="Notes (optional)"
          className="border border-neutral-200 dark:border-slate-700 focus:border-primary dark:focus:border-primary focus-visible:border-primary rounded-lg !shadow-none !ring-0 h-[120px]"
        />
      </div>

      {/* Total Balance */}
      <div className="mb-6">
        <span className="mb-1.5 text-sm text-neutral-500 dark:text-neutral-300">
          Total Balance
        </span>
        <h6 className="mb-1.5 font-semibold text-xl text-yellow-500 dark:text-yellow-500">
          $85,389
        </h6>
      </div>

      {/* Transfer Button */}
      <Button className={cn(`w-full h-11`)}>View All Entries</Button>
    </div>
  );
};

export default BuyBalanceContent;

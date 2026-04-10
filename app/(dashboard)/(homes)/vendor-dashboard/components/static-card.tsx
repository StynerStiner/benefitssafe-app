import CardSmallChartTwo from "@/components/charts/card-small-chart-two";
import DailyConversionsChart from "@/components/charts/daily-conversions-chart";
import TodayIncomeChart from "@/components/charts/today-income-chart";
import { Card, CardContent } from "@/components/ui/card";
import { Smile } from "lucide-react";

const StaticCard = () => {
  return (
    <Card className="card h-full rounded-lg border-0">
      <CardContent className="card-body p-0">
        <h3 className="mb-2 font-bold text-lg">Statistic</h3>
        <div className="mt-6 space-y-14">
          <div className="flex items-center gap-1 justify-between overflow-hidden">
            <div>
              <span className="text-neutral-500 dark:text-neutral-300 font-normal mb-3 text-xl">Daily Conversions</span>
              <h5 className="font-semibold mb-0">%60</h5>
            </div>
            <div className="relative h-[100px] w-[80px] flex items-center justify-center">
              <DailyConversionsChart />
              <span className="w-9 h-9 text-primary mb-0 rounded-full bg-primary/20 flex justify-center items-center absolute start-[12%] bottom-0"><Smile className="w-4 h-4" /></span>
            </div>
          </div>
          <div className="flex items-center gap-1 justify-between">
            <div>
              <span className="text-neutral-500 dark:text-neutral-300 font-normal mb-3 text-xl">Visits By Day</span>
              <h5 className="font-semibold mb-0">20k</h5>
            </div>
            <div className="remove-tooltip-title rounded-tooltip-value remove-tooltip-marker"><CardSmallChartTwo chartColor={"#ff9f29"} /></div>
          </div>
          <div className="flex items-center gap-1 justify-between">
            <div>
              <span className="text-neutral-500 dark:text-neutral-300 font-normal mb-3 text-xl">Today Income</span>
              <h5 className="font-semibold mb-0">$5.5k</h5>
            </div>
            <TodayIncomeChart />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
export default StaticCard;

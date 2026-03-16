import CustomersStatisticsChart from "@/components/charts/customers-statistics-chart";
import CustomSelect from "@/components/shared/custom-select";
import { Card, CardContent } from "@/components/ui/card";

const UsersActivateCard = ({ grants }: { grants: unknown[] }) => {
  return (
    <Card className="card h-full rounded-lg border-0">
      <CardContent className="card-body p-0">
        <div className="flex items-center flex-wrap gap-2 justify-between">
          <h6 className="mb-0 font-bold text-lg">Grant Activity</h6>
          <CustomSelect
            placeholder="Yearly"
            options={["Yearly", "Monthly", "Weekly", "Today"]}
          />
        </div>

        <div className="relative">
          <span className="w-[80px] h-[80px] bg-white dark:bg-slate-700 shadow-lg text-neutral-600 dark:text-neutral-200 font-semibold text-xl flex justify-center items-center rounded-full absolute end-0 top-0 z-1 me-11 mt-6">
            +80%
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
                $98,000
              </span>
            </span>
          </li>
          <li className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-xs bg-yellow-500"></span>
            <span className="text-neutral-500 dark:text-neutral-300 text-sm font-normal">
              Debits:
              <span className="text-neutral-600 dark:text-neutral-200 font-bold">
                $19,204
              </span>
            </span>
          </li>
        </ul>
      </CardContent>
    </Card>
  );
};

export default UsersActivateCard;

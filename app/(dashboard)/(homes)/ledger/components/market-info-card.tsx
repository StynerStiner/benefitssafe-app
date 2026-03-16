import CardSmallChart from "@/components/charts/card-small-chart";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface MarketItem {
  id: string;
  name: string;
  initials: string;
  iconBg: string;
  price: string;
  change: string;
  changeType: "positive" | "negative";
  chartBg: string;
}

const marketData: MarketItem[] = [
  {
    id: "writing",
    name: "Creative Writing Fellowship",
    initials: "CW",
    iconBg: "bg-blue-500",
    price: "$20,179",
    change: "+80%",
    changeType: "positive",
    chartBg: "#45B369",
  },
  {
    id: "digital",
    name: "Digital Skills Training",
    initials: "DS",
    iconBg: "bg-green-500",
    price: "$13,710",
    change: "+91%",
    changeType: "positive",
    chartBg: "#45B369",
  },
  {
    id: "housing",
    name: "Housing Stability Support",
    initials: "HS",
    iconBg: "bg-teal-500",
    price: "$41,500",
    change: "+83%",
    changeType: "positive",
    chartBg: "#45B369",
  },
  {
    id: "artist",
    name: "Artist Residency Grant",
    initials: "AR",
    iconBg: "bg-neutral-500",
    price: "$0",
    change: "100%",
    changeType: "positive",
    chartBg: "#45B369",
  },
  {
    id: "emergency",
    name: "Emergency Relief Fund",
    initials: "ER",
    iconBg: "bg-yellow-500",
    price: "$10,000",
    change: "0%",
    changeType: "negative",
    chartBg: "#EF4A00",
  },
];

const MarketInfoCard = ({ ledgerEntries }: { ledgerEntries: unknown[] }) => {
  return (
    <Card className="card h-full rounded-lg border-0">
      <CardContent className="card-body p-0">
        <div className="flex items-center flex-wrap gap-2 justify-between mb-5">
          <h6 className="mb-0 font-bold text-lg">Ledger Entries</h6>
          <div className="border border-neutral-200 dark:border-neutral-500 rounded-md px-4 py-2 pe-0 flex items-center gap-1 text-sm text-neutral-500 dark:text-neutral-300">
            Currency:
            <Select>
              <SelectTrigger className="w-[80px] !h-[32px] focus-visible:shadow-none focus-visible:ring-0 font-medium bg-transparent dark:bg-transparent text-neutral-900 dark:text-white border-0  data-[placeholder]:text-neutral-900">
                <SelectValue placeholder="USD" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="BDT">BDT</SelectItem>
                  <SelectItem value="RUP">RUP</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-5">
          {marketData.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-2 bg-neutral-200/75 dark:bg-slate-700 px-3 py-2 rounded"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-white text-xs font-semibold ${item.iconBg}`}
                >
                  {item.initials}
                </span>
                <div className="grow">
                  <h6 className="text-base mb-0">{item.name}</h6>
                </div>
              </div>
              <h6 className="text-base font-medium mb-0">{item.price}</h6>
              <span
                className={`text-base font-medium ${item.changeType === "positive"
                  ? "text-green-600"
                  : "text-red-600"
                  }`}
              >
                {item.change}
              </span>
              <div className="remove-tooltip-title rounded-tooltip-value remove-tooltip-marker">
                <CardSmallChart chartColor={item.chartBg} />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default MarketInfoCard;

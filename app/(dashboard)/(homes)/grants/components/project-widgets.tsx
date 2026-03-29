import { Card, CardContent } from "@/components/ui/card";
import { FileText, ScrollText, DollarSign, TrendingUp } from "lucide-react";

interface Grant {
  id: string;
  status: string;
  totalAmount: string;
  spentAmount: string;
}

interface StatItem {
  id: number;
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  blurColor: string;
}

const ProjectWidgets = ({ grants }: { grants: Grant[] }) => {
    const totalGrants = grants.length;
    const activeGrants = grants.filter((g) => g.status === "ACTIVE").length;
    const totalAmount = grants.reduce((sum, g) => sum + parseFloat(g.totalAmount || "0"), 0);
    const totalDisbursed = grants.reduce((sum, g) => sum + parseFloat(g.spentAmount || "0"), 0);

    const statsData: StatItem[] = [
        {
            id: 1,
            title: "Total Grants",
            value: totalGrants,
            icon: <FileText />,
            color: "bg-red-600",
            blurColor: "bg-red-500/30",
        },
        {
            id: 2,
            title: "Active Grants",
            value: activeGrants,
            icon: <TrendingUp />,
            color: "bg-green-600",
            blurColor: "bg-green-500/30",
        },
        {
            id: 3,
            title: "Total Allocated",
            value: `$${totalAmount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
            icon: <DollarSign />,
            color: "bg-yellow-500",
            blurColor: "bg-yellow-500/30",
        },
        {
            id: 4,
            title: "Total Disbursed",
            value: `$${totalDisbursed.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
            icon: <ScrollText />,
            color: "bg-cyan-600",
            blurColor: "bg-cyan-500/30",
        },
    ];

    return (
        <>
            {statsData.map((item) => (
                <div key={item.id} className="col-span-12 sm:col-span-6 2xl:col-span-3">
                    <Card className="bg-white dark:bg-[#273142] p-4 rounded-lg relative overflow-hidden border-0">
                        <span
                            className={`w-[155px] h-[40px] -translate-y-1/2 -rotate-[27.131deg] rounded-[130px] ${item.blurColor} blur-[32px] -me-[30px] absolute end-0 top-[50%]`}
                        ></span>

                        <CardContent className="px-0">
                            <div className="flex items-center justify-between gap-1">
                                <div>
                                    <span className="text-neutral-500 dark:text-neutral-300 text-sm font-medium">
                                        {item.title}
                                    </span>
                                    <h6 className="text-2xl mb-0 font-semibold">{item.value}</h6>
                                </div>
                                <span
                                    className={`w-[40px] h-[40px] rounded-lg ${item.color} text-white flex justify-center items-center text-[24px]`}
                                >
                                    {item.icon}
                                </span>
                            </div>

                            <span
                                className="bg-green-500/20 text-green-600 dark:text-green-500 text-sm py-1 px-6 mt-2.5 rounded inline-block"
                            >
                                {item.title}
                            </span>
                        </CardContent>
                    </Card>
                </div>
            ))}
        </>
    );
}

export default ProjectWidgets;

import { Card, CardContent } from "@/components/ui/card";
import {
    ArrowUpRight,
    BadgePercent,
    CircleDollarSign,
    Inbox,
    UserRound,
} from "lucide-react";

interface Expense {
    amount: string;
    status: string;
}

type WidgetItem = {
    id: number;
    title: string;
    value: string;
    lastMonth: string;
    percent: string;
    icon: React.ReactNode;
    iconBg: string;
    gradient: string;
};

const SalesWidgetsCard = ({ expenses }: { expenses: Expense[] }) => {
    const paid = expenses.filter((e) => e.status === "PAID");
    const pending = expenses.filter((e) => e.status === "PENDING");
    const approved = expenses.filter((e) => e.status === "APPROVED");
    const totalPaid = paid.reduce((sum, e) => sum + parseFloat(e.amount || "0"), 0);
    const totalPending = pending.reduce((sum, e) => sum + parseFloat(e.amount || "0"), 0);

    const widgets: WidgetItem[] = [
        {
            id: 1,
            title: "Total Invoices",
            value: expenses.length.toLocaleString(),
            lastMonth: `${paid.length} paid`,
            percent: `${expenses.length > 0 ? Math.round((paid.length / expenses.length) * 100) : 0}%`,
            icon: <Inbox />,
            iconBg: "bg-blue-600",
            gradient:
                "bg-[linear-gradient(190deg,rgba(255,255,255,0.14)_8.24%,rgba(13,110,253,0.05)_89.87%)]",
        },
        {
            id: 2,
            title: "Pending",
            value: pending.length.toLocaleString(),
            lastMonth: `${approved.length} approved`,
            percent: `${expenses.length > 0 ? Math.round((pending.length / expenses.length) * 100) : 0}%`,
            icon: <UserRound />,
            iconBg: "bg-yellow-400",
            gradient:
                "bg-[linear-gradient(190deg,rgba(255,255,255,0)_8.24%,rgba(255,159,41,0.09)_89.87%)]",
        },
        {
            id: 3,
            title: "Total Received",
            value: `$${totalPaid.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
            lastMonth: `${paid.length} payments`,
            percent: `${expenses.length > 0 ? Math.round((paid.length / expenses.length) * 100) : 0}%`,
            icon: <BadgePercent />,
            iconBg: "bg-purple-600",
            gradient:
                "bg-[linear-gradient(190deg,rgba(255,255,255,0)_8.24%,rgba(130,82,233,0.09)_89.87%)]",
        },
        {
            id: 4,
            title: "Total Pending",
            value: `$${totalPending.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
            lastMonth: `${pending.length} invoices`,
            percent: `${expenses.length > 0 ? Math.round((pending.length / expenses.length) * 100) : 0}%`,
            icon: <CircleDollarSign />,
            iconBg: "bg-cyan-600",
            gradient:
                "bg-[linear-gradient(190deg,rgba(255,255,255,0.14)_8.24%,rgba(13,202,240,0.10)_89.87%)]",
        },
    ];
    return (
        <Card className="card h-full rounded-lg border-0">
            <CardContent className="p-0">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                    {widgets.map((item) => (
                        <div
                            key={item.id}
                            className="col-span-12 sm:col-span-6 2xl:col-span-3"
                        >
                            <div
                                className={`px-6 py-4 rounded-lg border border-neutral-200 dark:border-neutral-200/20 h-full ${item.gradient}`}
                            >
                                <div className="flex justify-between items-center gap-3">
                                    <div className="grow">
                                        <h6 className="font-semibold mb-0">
                                            {item.value}
                                        </h6>
                                        <span className="text-neutral-500 dark:text-neutral-200 mt-1 block">
                                            {item.title}
                                        </span>
                                    </div>

                                    <span
                                        className={`${item.iconBg} w-12 h-12 rounded-full flex items-center justify-center text-white`}
                                    >
                                        {item.icon}
                                    </span>
                                </div>

                                <p className="text-sm mt-5 mb-0">
                                    <span className="bg-white dark:bg-black shadow px-2 py-1 rounded-md font-medium text-green-500 text-sm inline-flex items-center gap-1 me-1.5">
                                        <ArrowUpRight className="size-4" />
                                        {item.percent}
                                    </span>
                                    {item.lastMonth}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};

export default SalesWidgetsCard;

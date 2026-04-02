import { ArrowLeftToLine, ArrowRightToLine } from "lucide-react";
import RadialProgress from "./radial-progress";

interface Expense {
    status: string;
}

const CheckInOut = ({ expenses }: { expenses: Expense[] }) => {
    // Calculate approval vs rejection rates from real expense data
    const total = expenses.length;
    const approved = expenses.filter((e) => e.status === "APPROVED" || e.status === "PAID").length;
    const rejected = expenses.filter((e) => e.status === "REJECTED" || e.status === "BLOCKED").length;

    const approvedPct = total > 0 ? Math.round((approved / total) * 100) : 0;
    const rejectedPct = total > 0 ? Math.round((rejected / total) * 100) : 0;

    return (
        <div className="bg-card text-card-foreground flex flex-col gap-6 shadow-sm card h-full rounded-lg border-0 !py-0">
            <div className="card-body py-12 px-4 flex items-center justify-between gap-24 flex-wrap">
                <RadialProgress
                    percentage={approvedPct}
                    color="#45b369"
                    size={140}
                    strokeWidth={12}
                    icon={
                        <span className="w-8 h-8 bg-green-500 rounded-full flex justify-center items-center text-white">
                            <ArrowLeftToLine className="w-4 h-4" />
                        </span>
                    }
                    label="Approved"
                />

                <RadialProgress
                    percentage={rejectedPct}
                    color="#ff9f29"
                    size={140}
                    strokeWidth={12}
                    icon={
                        <span className="w-8 h-8 bg-yellow-500 rounded-full flex justify-center items-center text-white">
                            <ArrowRightToLine className="w-4 h-4" />
                        </span>
                    }
                    label="Rejected"
                />
            </div>
        </div>
    );
};

export default CheckInOut;

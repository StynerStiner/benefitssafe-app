import { Badge } from "@/components/ui/badge";
import { Banknote, RotateCcw, CircleDollarSign, Home } from "lucide-react";

interface Policy {
    cashToRecipient: string;
    reimbursementToRecipient: string;
    maxSingleTransaction: string | null;
    rentUtilityPayments: string;
}

const settingBadge = (val: string) => {
    if (val === "ALLOWED") return <Badge variant="success">Allowed</Badge>;
    if (val === "DISALLOWED") return <Badge variant="danger">Blocked</Badge>;
    return <Badge variant="warning">Review</Badge>;
};

const StatisticsCards = ({ policy }: { policy: Policy | null }) => {
    const maxTx = policy?.maxSingleTransaction ? `$${parseFloat(policy.maxSingleTransaction).toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "No Limit";

    return (
        <div className="shadow-7 p-4 rounded-xl bg-white dark:bg-[#273142]">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                <div className="col-span-12 xs:col-span-6 sm:col-span-6">
                    <div className="py-5 px-6 rounded-lg relative z-1 h-full bg-[#A8C9F4]">
                        <span className="w-11 h-11 rounded-lg bg-white flex justify-center items-center">
                            <Banknote className="w-6 h-6 text-blue-600" />
                        </span>
                        <span className="block mt-3 text-neutral-800">Cash to Recipient</span>
                        <h6 className="mt-1 mb-0 dark:text-black">{policy ? settingBadge(policy.cashToRecipient) : "Not Set"}</h6>
                    </div>
                </div>
                <div className="col-span-12 xs:col-span-6 sm:col-span-6">
                    <div className="py-5 px-6 rounded-lg relative z-1 h-full bg-[#A4E7BC]">
                        <span className="w-11 h-11 rounded-lg bg-white flex justify-center items-center">
                            <RotateCcw className="w-6 h-6 text-green-600" />
                        </span>
                        <span className="block mt-3 text-neutral-800">Reimbursement</span>
                        <h6 className="mt-1 mb-0 dark:text-black">{policy ? settingBadge(policy.reimbursementToRecipient) : "Not Set"}</h6>
                    </div>
                </div>
                <div className="col-span-12 xs:col-span-6 sm:col-span-6">
                    <div className="py-5 px-6 rounded-lg relative z-1 h-full bg-[#FFBAAA]">
                        <span className="w-11 h-11 rounded-lg bg-white flex justify-center items-center">
                            <CircleDollarSign className="w-6 h-6 text-red-500" />
                        </span>
                        <span className="block mt-3 text-neutral-800">Max Transaction</span>
                        <h6 className="mt-1 mb-0 dark:text-black">{maxTx}</h6>
                    </div>
                </div>
                <div className="col-span-12 xs:col-span-6 sm:col-span-6">
                    <div className="py-5 px-6 rounded-lg relative z-1 h-full bg-[#FFDD96]">
                        <span className="w-11 h-11 rounded-lg bg-white flex justify-center items-center">
                            <Home className="w-6 h-6 text-yellow-600" />
                        </span>
                        <span className="block mt-3 text-neutral-800">Rent/Utilities</span>
                        <h6 className="mt-1 mb-0 dark:text-black">{policy ? settingBadge(policy.rentUtilityPayments) : "Not Set"}</h6>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StatisticsCards;

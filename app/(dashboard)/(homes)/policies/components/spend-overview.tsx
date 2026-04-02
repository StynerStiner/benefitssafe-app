import { Card, CardContent } from '@/components/ui/card';
import { RefreshCw, CreditCard, RotateCcw, Banknote } from 'lucide-react';
import RadialProgressBarSmall from './radial-progress-small';

interface Policy {
    cashToRecipient: string;
    reimbursementToRecipient: string;
    rentUtilityPayments: string;
    recurringSubscriptions: string;
    maxSingleTransaction: string | null;
}

function settingToLabel(setting: string): string {
    if (setting === "ALLOWED") return "Allowed";
    if (setting === "DISALLOWED") return "Blocked";
    if (setting === "REQUIRES_REVIEW") return "Requires Review";
    return setting;
}

function settingToPercentage(setting: string): number {
    if (setting === "ALLOWED") return 100;
    if (setting === "REQUIRES_REVIEW") return 50;
    if (setting === "DISALLOWED") return 0;
    return 20;
}

const SpendOverview = ({ policy }: { policy: Policy | null }) => {
    const subscriptionsSetting = policy?.recurringSubscriptions || "ALLOWED";
    const maxTransaction = policy?.maxSingleTransaction
        ? `$${parseFloat(policy.maxSingleTransaction).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} max`
        : "No limit";
    const reimbursementSetting = policy?.reimbursementToRecipient || "DISALLOWED";
    const cashSetting = policy?.cashToRecipient || "DISALLOWED";

    return (
        <Card className="card h-full rounded-lg border-0 !p-0">
            <CardContent className="card-body p-6">
                <div className="flex items-center flex-wrap gap-2 justify-between pb-6">
                    <h6 className="mb-0 font-bold text-lg">Policy Settings</h6>
                </div>

                <div className="flex flex-col gap-2.5">

                    <div className="flex items-center justify-between gap-10">
                        <div className="flex items-center gap-3">
                            <span
                                className="w-10 h-10 rounded-[50%] flex justify-center items-center dark:bg-slate-800 bg-[#E8EDFB]">
                                <RefreshCw className="w-5 h-5 text-blue-500" />
                            </span>
                            <div className="">
                                <h6 className="text-sm mb-2">Subscriptions</h6>
                                <span className="text-xs text-neutral-600 dark:text-neutral-300">{settingToLabel(subscriptionsSetting)}</span>
                            </div>
                        </div>
                        <div className="">
                            <span className="text-[#0a0a0a] dark:text-white text-sm block text-end">
                                <RadialProgressBarSmall percentage={settingToPercentage(subscriptionsSetting)} color="#1e90ff" size={48} textColor="#1e90ff" strokeWidth={4} />
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center justify-between gap-10">
                        <div className="flex items-center gap-3">
                            <span
                                className="w-10 h-10 rounded-[50%] flex justify-center items-center dark:bg-slate-800 bg-[#FDE4EA]">
                                <CreditCard className="w-5 h-5 text-red-500" />
                            </span>
                            <div className="">
                                <h6 className="text-sm mb-2">Direct Payments</h6>
                                <span className="text-xs text-neutral-600 dark:text-neutral-300">{maxTransaction}</span>
                            </div>
                        </div>
                        <div className="">
                            <span className="text-[#0a0a0a] dark:text-white text-sm block text-end">
                               <RadialProgressBarSmall percentage={policy?.maxSingleTransaction ? 60 : 100} color="#ef4a00" size={48} textColor="#ef4a00" strokeWidth={4} />
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center justify-between gap-10">
                        <div className="flex items-center gap-3">
                            <span
                                className="w-10 h-10 rounded-[50%] flex justify-center items-center dark:bg-slate-800 bg-[#FDE4EA]">
                                <RotateCcw className="w-5 h-5 text-yellow-500" />
                            </span>
                            <div className="">
                                <h6 className="text-sm mb-2">Reimbursements</h6>
                                <span className="text-xs text-neutral-600 dark:text-neutral-300">{settingToLabel(reimbursementSetting)}</span>
                            </div>
                        </div>
                        <div className="">
                            <span className="text-[#0a0a0a] dark:text-white text-sm block text-end">
                               <RadialProgressBarSmall percentage={settingToPercentage(reimbursementSetting)} color="#ff9f29" size={48} textColor="#ff9f29" strokeWidth={4} />
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center justify-between gap-10">
                        <div className="flex items-center gap-3">
                            <span
                                className="w-10 h-10 rounded-[50%] flex justify-center items-center dark:bg-slate-800 bg-[#E3F4E9]">
                                <Banknote className="w-5 h-5 text-green-500" />
                            </span>
                            <div className="">
                                <h6 className="text-sm mb-2">Cash</h6>
                                <span className="text-xs text-neutral-600 dark:text-neutral-300">{settingToLabel(cashSetting)}</span>
                            </div>
                        </div>
                        <div className="">
                            <span className="text-[#0a0a0a] dark:text-white text-sm block text-end">
                               <RadialProgressBarSmall percentage={settingToPercentage(cashSetting)} color="#45b369" size={48} textColor="#45b369" strokeWidth={4} />
                            </span>
                        </div>
                    </div>

                </div>

            </CardContent>
        </Card>
    );
};

export default SpendOverview;
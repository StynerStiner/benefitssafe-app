import SemiCircleGaugeTwo from "@/components/charts/semi-circle-gauge-two";

interface Policy {
    cashToRecipient: string;
    reimbursementToRecipient: string;
    rentUtilityPayments: string;
    recurringSubscriptions: string;
    maxSingleTransaction: string | null;
    allowedCategories: string[] | null;
    blockedCategories: string[] | null;
}

const AvailableRoom = ({ policy }: { policy: Policy | null }) => {
    // Count active rules from the policy object
    const ruleCount = (() => {
        if (!policy) return 0;
        let count = 0;
        // Each policy setting that is not null counts as a rule
        if (policy.cashToRecipient) count++;
        if (policy.reimbursementToRecipient) count++;
        if (policy.rentUtilityPayments) count++;
        if (policy.recurringSubscriptions) count++;
        if (policy.maxSingleTransaction) count++;
        // Count allowed and blocked categories
        const allowed = Array.isArray(policy.allowedCategories) ? policy.allowedCategories.length : 0;
        const blocked = Array.isArray(policy.blockedCategories) ? policy.blockedCategories.length : 0;
        count += allowed + blocked;
        return count;
    })();

    return (
        <div className="shadow-7 p-6 rounded-xl bg-white dark:bg-[#273142] h-full">
            <div className="text-center">
                <div className="relative">
                    <div className="big-semi-circle-gauge flex justify-center">
                        <SemiCircleGaugeTwo />
                    </div>
                    <span
                        className="w-[90px] h-[90px] rounded-[50%] bg-primary-50 flex justify-center items-center absolute start-[50%] bottom-0 translate-x-[-50%] rtl:translate-x-[50%]">
                        <img src="assets/images/home-twelve/icons/home.png" alt="Home Icon" />
                    </span>
                </div>
                <h3 className="mt-10 mb-0 leading-none">{ruleCount}</h3>
                <span className="text-neutral-800 dark:text-neutral-300 mt-4">Payment Rules Active</span>
            </div>
        </div>
    );
};

export default AvailableRoom;
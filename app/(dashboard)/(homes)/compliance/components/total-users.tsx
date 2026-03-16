import { ArrowUp, Users } from "lucide-react";

const TotalUsers = () => {
    return (
        <div className="bg-white dark:bg-[#273142] rounded-xl py-5 px-6 shadow">
            <div className="flex items-center justify-between">
                <div className="">
                    <span className="text-neutral-600 dark:text-neutral-200 mb-2">Total Users</span>
                    <div className="flex items-center gap-3">
                        <h6 className="mb-0">17,500</h6>
                        <div
                            className="flex items-center gap-1 font-semibold text-green-600 dark:text-green-500">
                            <span className="text-green-600 dark:text-green-500">+2.5%</span>
                            <ArrowUp className="w-4 h-4" />
                        </div>
                    </div>
                </div>
                <span
                    className="w-[60px] h-[60px] bg-blue-600 text-white rounded-[50%] flex justify-center items-center text-2xl shadow-[0px_17px_30px_-4px_rgba(72,127,255,0.4)]">
                    <Users className="w-8 h-8" />
                </span>
            </div>

            <div className="mt-[32px] flex items-center justify-between gap-3 flex-wrap">
                <div className="py-2 px-3 rounded-md bg-gradient-to-t from-blue-500/15 to-bg-white grow">
                    <span className="text-neutral-600 dark:text-neutral-200 mb-2 text-sm">Active User:</span>
                    <h6 className="mb-0 text-xl">3,500</h6>
                </div>
                <div className="py-2 px-3 rounded-md bg-gradient-to-t from-cyan-500/15 to-bg-white grow">
                    <span className="text-neutral-600 dark:text-neutral-200 mb-2 text-sm">New Sign ups:</span>
                    <h6 className="mb-0 text-xl">5,700</h6>
                </div>
                <div className="py-2 px-3 rounded-md bg-gradient-to-t from-purple-500/15 to-bg-white grow">
                    <span className="text-neutral-600 dark:text-neutral-200 mb-2 text-sm">Subscribed:</span>
                    <h6 className="mb-0 text-xl">8,000</h6>
                </div>
            </div>
        </div>
    );
};

export default TotalUsers;
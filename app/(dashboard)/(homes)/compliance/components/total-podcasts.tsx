import { ArrowUp, Mic } from "lucide-react";

const TotalPodcasts = () => {
    return (
        <div className="bg-white dark:bg-[#273142] rounded-xl py-5 px-6 shadow">
            <div className="flex items-center justify-between">
                <div className="">
                    <span className="text-neutral-600 dark:text-neutral-200 mb-2">Total Podcasts</span>
                    <div className="flex items-center gap-3">
                        <h6 className="mb-0">450</h6>
                        <div
                            className="flex items-center gap-1 font-semibold text-green-600 dark:text-green-500">
                            <span className="text-green-600 dark:text-green-500">+2.5%</span>
                            <ArrowUp className="w-4 h-4" />
                        </div>
                    </div>
                </div>
                <span
                    className="w-[60px] h-[60px] bg-yellow-500 text-white rounded-[50%] flex justify-center items-center text-2xl shadow-[0px_17px_30px_-4px_rgba(255,159,41,0.4)]">
                    <Mic className="w-8 h-8" />
                </span>
            </div>

            <div className="mt-[32px] flex items-center justify-between gap-3 flex-wrap">
                <div className="py-2 px-3 rounded-md bg-gradient-to-t from-red-500/15 to-bg-white grow">
                    <span className="text-neutral-600 dark:text-neutral-200 mb-2 text-sm">Trending:</span>
                    <h6 className="mb-0 text-xl">60</h6>
                </div>
                <div className="py-2 px-3 rounded-md bg-gradient-to-t from-yellow-500/15 to-bg-white grow">
                    <span className="text-neutral-600 dark:text-neutral-200 mb-2 text-sm">Free Podcasts:</span>
                    <h6 className="mb-0 text-xl">240</h6>
                </div>
                <div className="py-2 px-3 rounded-md bg-gradient-to-t from-green-500/15 to-bg-white grow">
                    <span className="text-neutral-600 dark:text-neutral-200 mb-2 text-sm">Premium:</span>
                    <h6 className="mb-0 text-xl">150</h6>
                </div>
            </div>
        </div>
    );
};

export default TotalPodcasts;
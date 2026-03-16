import PodcastTopCategoriesChart from "@/components/charts/podcast-top-categories-chart";
import CommonLink from "@/components/shared/common-link";
import { Card, CardContent } from "@/components/ui/card";


const PodcastTopCategoriesCard = () => {
    return (
        <Card className="card !p-0 border-0 rounded-xl shadow-none">
            <CardContent className="p-0">
                <div className="border-b border-neutral-200 dark:border-slate-500 py-4 px-6 flex items-center justify-between flex-wrap gap-2">
                    <h6 className="font-semibold text-lg mb-0 text-foreground">Top 5 Categories</h6>
                    <CommonLink />
                </div>

                <div className="card-body py-[32px] px-6 mt-5 flex items-center justify-between">
                    <div className="">
                        <PodcastTopCategoriesChart />
                    </div>
                    <ul className="flex flex-col gap-3">
                        <li>
                            <span className="text-lg">UI/UX Design: <span
                                className="text-green-600 dark:text-green-600 font-semibold">50%</span> </span>
                        </li>
                        <li>
                            <span className="text-lg">Entertainment: <span className="text-purple-600 dark:text-purple-600 font-semibold">30%</span>
                            </span>
                        </li>
                        <li>
                            <span className="text-lg">Lifestyle: <span className="text-red-600 dark:text-red-600 font-semibold">87%</span>
                            </span>
                        </li>
                        <li>
                            <span className="text-lg">Business: <span className="text-blue-600 dark:text-blue-600 font-semibold">87%</span>
                            </span>
                        </li>
                        <li>
                            <span className="text-lg">Health: <span className="text-yellow-600 dark:text-yellow-600 font-semibold">40%</span>
                            </span>
                        </li>
                    </ul>
                </div>
            </CardContent>
        </Card>
    );
};

export default PodcastTopCategoriesCard;

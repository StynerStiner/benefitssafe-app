import CustomSelect from "@/components/shared/custom-select";
import { Card, CardContent } from '@/components/ui/card';

const WorkingScheduleCard = ({ grants }: { grants: unknown[] }) => {
    return (

        <Card className="card !p-0 border-0 rounded-xl shadow-none">
            <CardContent className="p-0">
                <div className="border-b border-neutral-200 dark:border-slate-500 py-4 px-6 flex items-center justify-between flex-wrap gap-2">
                    <h6 className="font-semibold text-lg mb-0 text-foreground">Grant Schedule</h6>
                    <CustomSelect
                        placeholder="Jan 2025"
                        options={["Jan 2025", "Feb 2025", "March 2025", "April 2025", "May 2025", "June 2025", "July 2025", "Aug 2025", "Sep 2025", "Oct 2025", "Nov 2025", "Dec 2025"]}
                    />
                </div>
                <div className="card-body p-6">
                    <div className="flex items-center gap-4 justify-between flex-wrap">
                        <div className="week-item text-center">
                            <span className="text-sm text-neutral-400 font-medium">Fr</span>
                            <h6 className="text-base mb-0">21</h6>
                        </div>
                        <div className="week-item text-center">
                            <span className="text-sm text-neutral-400 font-medium">Sa</span>
                            <h6 className="text-base mb-0">22</h6>
                        </div>
                        <div className="week-item text-center">
                            <span className="text-sm text-neutral-400 font-medium">Su</span>
                            <h6 className="text-base mb-0">23</h6>
                        </div>
                        <div className="week-item text-center">
                            <span className="text-sm text-neutral-400 font-medium">Mo</span>
                            <h6 className="text-base mb-0">24</h6>
                        </div>
                        <div className="week-item text-center bg-purple-500 rounded-[50rem] py-3 px-4">
                            <span className="text-sm text-white font-medium">Tu</span>
                            <h6 className="text-base mb-0 text-white">25</h6>
                        </div>
                        <div className="week-item text-center">
                            <span className="text-sm text-neutral-400 font-medium">We</span>
                            <h6 className="text-base mb-0">26</h6>
                        </div>
                        <div className="week-item text-center">
                            <span className="text-sm text-neutral-400 font-medium">Th</span>
                            <h6 className="text-base mb-0">27</h6>
                        </div>
                        <div className="text-center">
                            <span className="text-sm text-neutral-400 font-medium">Fr</span>
                            <h6 className="text-base mb-0">28</h6>
                        </div>
                        <div className="text-center">
                            <span className="text-sm text-neutral-400 font-medium">Sa</span>
                            <h6 className="text-base mb-0">29</h6>
                        </div>
                        <div className="text-center">
                            <span className="text-sm text-neutral-400 font-medium">Su</span>
                            <h6 className="text-base mb-0">30</h6>
                        </div>
                    </div>

                    <div className="mt-6 flex flex-col gap-5">
                        <div
                            className="flex items-center justify-between gap-1 ps-2.5 border-inline-start border-start-width-[3px] border-purple">
                            <div className="">
                                <div className="flex items-center gap-1">
                                    <h6 className="text-lg mb-0">10:20 - 11:00</h6>
                                    <span className="text-xs text-neutral-500 dark:text-neutral-300 font-medium">AM</span>
                                </div>
                                <p className="text-sm text-neutral-500 dark:text-neutral-300 font-medium mb-1">UI UX Dashboard Project
                                    Meeting</p>
                                <p className="text-xs text-neutral-400 font-medium mb-0">Lead by <span
                                    className="text-green-600">Jane Cooper</span> </p>
                            </div>
                            <div className="">
                                <a href="javascript:void(0)"
                                    className="bg-neutral-200 dark:bg-neutral-600 dark:hover:bg-neutral-500 hover:bg-neutral-600 hover:text-white text-sm text-[#0a0a0a] dark:text-white py-1.5 rounded px-6">View </a>
                            </div>
                        </div>
                        <div
                            className="flex items-center justify-between gap-1 ps-2.5 border-inline-start border-start-width-[3px] border-yellow-600">
                            <div className="">
                                <div className="flex items-center gap-1">
                                    <h6 className="text-lg mb-0">10:20 - 11:00</h6>
                                    <span className="text-xs text-neutral-500 dark:text-neutral-300 font-medium">AM</span>
                                </div>
                                <p className="text-sm text-neutral-500 dark:text-neutral-300 font-medium mb-1">UI UX Dashboard Project
                                    Meeting</p>
                                <p className="text-xs text-neutral-400 font-medium mb-0">Lead by <span
                                    className="text-green-600">Jane Cooper</span> </p>
                            </div>
                            <div className="">
                                <a href="javascript:void(0)"
                                    className="bg-neutral-200 dark:bg-neutral-600 dark:hover:bg-neutral-500 hover:bg-neutral-600 hover:text-white text-sm text-[#0a0a0a] dark:text-white py-1.5 rounded px-6">View </a>
                            </div>
                        </div>
                        <div
                            className="flex items-center justify-between gap-1 ps-2.5 border-inline-start border-start-width-[3px] border-cyan-600">
                            <div className="">
                                <div className="flex items-center gap-1">
                                    <h6 className="text-lg mb-0">10:20 - 11:00</h6>
                                    <span className="text-xs text-neutral-500 dark:text-neutral-300 font-medium">AM</span>
                                </div>
                                <p className="text-sm text-neutral-500 dark:text-neutral-300 font-medium mb-1">UI UX Dashboard Project
                                    Meeting</p>
                                <p className="text-xs text-neutral-400 font-medium mb-0">Lead by <span
                                    className="text-green-600">Jane Cooper</span> </p>
                            </div>
                            <div className="">
                                <a href="javascript:void(0)"
                                    className="bg-neutral-200 dark:bg-neutral-600 dark:hover:bg-neutral-500 hover:bg-neutral-600 hover:text-white text-sm text-[#0a0a0a] dark:text-white py-1.5 rounded px-6">View </a>
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default WorkingScheduleCard;
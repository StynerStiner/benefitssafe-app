
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Star } from "lucide-react";
import Link from "next/link";

const EmailList = () => {
    return (
        <ul className="overflow-x-auto">
            <li className="email-item px-6 py-4 flex gap-4 items-center border-b last:border-0 border-neutral-200 dark:border-slate-700 cursor-pointer hover:bg-neutral-200 dark:hover:bg-slate-800 min-w-max">
                <div className="form-check style-check flex items-center">
                    <Checkbox
                        className="border border-neutral-500 w-4 h-4"
                    />
                </div>
                <Button variant="link" className="!p-0 bg-transparent starred-button icon text-xl text-neutral-500 dark:text-neutral-300 line-height-1 flex">
                    <Star className="w-4" />
                </Button>
                <Link href="/email-details" className="text-neutral-600 dark:text-neutral-200 font-medium text-base text-line-1 w-[190px]">System</Link>
                <Link href="/email-details" className="text-neutral-600 dark:text-neutral-200 font-medium mb-0 line-clamp-1 max-w-[740px]">Grant &apos;Creative Writing Fellowship&apos; approved — $25,000 allocated to Test Nonprofit</Link>
                <span className="text-neutral-600 dark:text-neutral-200 font-medium min-w-max-content ms-auto">Mar 16</span>
            </li>
            <li className="email-item px-6 py-4 flex gap-4 items-center border-b last:border-0 border-neutral-200 dark:border-slate-700 cursor-pointer hover:bg-neutral-200 dark:hover:bg-slate-800 min-w-max">
                <div className="form-check style-check flex items-center">
                    <Checkbox
                        className="border border-neutral-500 w-4 h-4"
                    />
                </div>
                <Button variant="link" className="!p-0 bg-transparent starred-button icon text-xl text-neutral-500 dark:text-neutral-300 line-height-1 flex">
                    <Star className="w-4" />
                </Button>
                <Link href="/email-details" className="text-neutral-600 dark:text-neutral-200 font-medium text-base text-line-1 w-[190px]">James Carter</Link>
                <Link href="/email-details" className="text-neutral-600 dark:text-neutral-200 font-medium mb-0 line-clamp-1 max-w-[740px]">Expense request pending review — $800.00 for Writing Workshop registration</Link>
                <span className="text-neutral-600 dark:text-neutral-200 font-medium min-w-max-content ms-auto">Mar 15</span>
            </li>
            <li className="email-item px-6 py-4 flex gap-4 items-center border-b last:border-0 border-neutral-200 dark:border-slate-700 cursor-pointer hover:bg-neutral-200 dark:hover:bg-slate-800 min-w-max">
                <div className="form-check style-check flex items-center">
                    <Checkbox
                        className="border border-neutral-500 w-4 h-4"
                    />
                </div>
                <Button variant="link" className="!p-0 bg-transparent starred-button icon text-xl text-neutral-500 dark:text-neutral-300 line-height-1 flex">
                    <Star className="w-4" />
                </Button>
                <Link href="/email-details" className="text-neutral-600 dark:text-neutral-200 font-medium text-base text-line-1 w-[190px]">System</Link>
                <Link href="/email-details" className="text-neutral-600 dark:text-neutral-200 font-medium mb-0 line-clamp-1 max-w-[740px]">Vendor Adobe Inc approved — now available for expense payments</Link>
                <span className="text-neutral-600 dark:text-neutral-200 font-medium min-w-max-content ms-auto">Mar 14</span>
            </li>
            <li className="email-item px-6 py-4 flex gap-4 items-center border-b last:border-0 border-neutral-200 dark:border-slate-700 cursor-pointer hover:bg-neutral-200 dark:hover:bg-slate-800 min-w-max">
                <div className="form-check style-check flex items-center">
                    <Checkbox
                        className="border border-neutral-500 w-4 h-4"
                    />
                </div>
                <Button variant="link" className="!p-0 bg-transparent starred-button icon text-xl text-neutral-500 dark:text-neutral-300 line-height-1 flex">
                    <Star className="w-4" />
                </Button>
                <Link href="/email-details" className="text-neutral-600 dark:text-neutral-200 font-medium text-base text-line-1 w-[190px]">System</Link>
                <Link href="/email-details" className="text-neutral-600 dark:text-neutral-200 font-medium mb-0 line-clamp-1 max-w-[740px]">Virtual card issued — •••• 4242 assigned to James Carter with $660 spending cap</Link>
                <span className="text-neutral-600 dark:text-neutral-200 font-medium min-w-max-content ms-auto">Mar 12</span>
            </li>
            <li className="email-item px-6 py-4 flex gap-4 items-center border-b last:border-0 border-neutral-200 dark:border-slate-700 cursor-pointer hover:bg-neutral-200 dark:hover:bg-slate-800 min-w-max">
                <div className="form-check style-check flex items-center">
                    <Checkbox
                        className="border border-neutral-500 w-4 h-4"
                    />
                </div>
                <Button variant="link" className="!p-0 bg-transparent starred-button icon text-xl text-neutral-500 dark:text-neutral-300 line-height-1 flex">
                    <Star className="w-4" />
                </Button>
                <Link href="/email-details" className="text-neutral-600 dark:text-neutral-200 font-medium text-base text-line-1 w-[190px]">James Carter</Link>
                <Link href="/email-details" className="text-neutral-600 dark:text-neutral-200 font-medium mb-0 line-clamp-1 max-w-[740px]">Submitted expense — $450.00 for laptop repair under Digital Skills Training grant</Link>
                <span className="text-neutral-600 dark:text-neutral-200 font-medium min-w-max-content ms-auto">Mar 10</span>
            </li>
            <li className="email-item px-6 py-4 flex gap-4 items-center border-b last:border-0 border-neutral-200 dark:border-slate-700 cursor-pointer hover:bg-neutral-200 dark:hover:bg-slate-800 min-w-max">
                <div className="form-check style-check flex items-center">
                    <Checkbox
                        className="border border-neutral-500 w-4 h-4"
                    />
                </div>
                <Button variant="link" className="!p-0 bg-transparent starred-button icon text-xl text-neutral-500 dark:text-neutral-300 line-height-1 flex">
                    <Star className="w-4" />
                </Button>
                <Link href="/email-details" className="text-neutral-600 dark:text-neutral-200 font-medium text-base text-line-1 w-[190px]">System</Link>
                <Link href="/email-details" className="text-neutral-600 dark:text-neutral-200 font-medium mb-0 line-clamp-1 max-w-[740px]">Subscription billing updated — ChatGPT Plus renewed at $20.00/mo</Link>
                <span className="text-neutral-600 dark:text-neutral-200 font-medium min-w-max-content ms-auto">Mar 8</span>
            </li>
            <li className="email-item px-6 py-4 flex gap-4 items-center border-b last:border-0 border-neutral-200 dark:border-slate-700 cursor-pointer hover:bg-neutral-200 dark:hover:bg-slate-800 min-w-max">
                <div className="form-check style-check flex items-center">
                    <Checkbox
                        className="border border-neutral-500 w-4 h-4"
                    />
                </div>
                <Button variant="link" className="!p-0 bg-transparent starred-button icon text-xl text-neutral-500 dark:text-neutral-300 line-height-1 flex">
                    <Star className="w-4" />
                </Button>
                <Link href="/email-details" className="text-neutral-600 dark:text-neutral-200 font-medium text-base text-line-1 w-[190px]">Sarah Mitchell</Link>
                <Link href="/email-details" className="text-neutral-600 dark:text-neutral-200 font-medium mb-0 line-clamp-1 max-w-[740px]">Approved expense — $1,500.00 for Maria&apos;s Editing Services under Creative Writing Fellowship</Link>
                <span className="text-neutral-600 dark:text-neutral-200 font-medium min-w-max-content ms-auto">Mar 6</span>
            </li>
            <li className="email-item px-6 py-4 flex gap-4 items-center border-b last:border-0 border-neutral-200 dark:border-slate-700 cursor-pointer hover:bg-neutral-200 dark:hover:bg-slate-800 min-w-max">
                <div className="form-check style-check flex items-center">
                    <Checkbox
                        className="border border-neutral-500 w-4 h-4"
                    />
                </div>
                <Button variant="link" className="!p-0 bg-transparent starred-button icon text-xl text-neutral-500 dark:text-neutral-300 line-height-1 flex">
                    <Star className="w-4" />
                </Button>
                <Link href="/email-details" className="text-neutral-600 dark:text-neutral-200 font-medium text-base text-line-1 w-[190px]">System</Link>
                <Link href="/email-details" className="text-neutral-600 dark:text-neutral-200 font-medium mb-0 line-clamp-1 max-w-[740px]">Compliance alert — Housing expense flagged as NEEDS_REVIEW for James Carter</Link>
                <span className="text-neutral-600 dark:text-neutral-200 font-medium min-w-max-content ms-auto">Mar 4</span>
            </li>
            <li className="email-item px-6 py-4 flex gap-4 items-center border-b last:border-0 border-neutral-200 dark:border-slate-700 cursor-pointer hover:bg-neutral-200 dark:hover:bg-slate-800 min-w-max">
                <div className="form-check style-check flex items-center">
                    <Checkbox
                        className="border border-neutral-500 w-4 h-4"
                    />
                </div>
                <Button variant="link" className="!p-0 bg-transparent starred-button icon text-xl text-neutral-500 dark:text-neutral-300 line-height-1 flex">
                    <Star className="w-4" />
                </Button>
                <Link href="/email-details" className="text-neutral-600 dark:text-neutral-200 font-medium text-base text-line-1 w-[190px]">Sarah Mitchell</Link>
                <Link href="/email-details" className="text-neutral-600 dark:text-neutral-200 font-medium mb-0 line-clamp-1 max-w-[740px]">New beneficiary added — Jordan Lee enrolled in Housing Stability Support grant</Link>
                <span className="text-neutral-600 dark:text-neutral-200 font-medium min-w-max-content ms-auto">Mar 2</span>
            </li>
            <li className="email-item px-6 py-4 flex gap-4 items-center border-b last:border-0 border-neutral-200 dark:border-slate-700 cursor-pointer hover:bg-neutral-200 dark:hover:bg-slate-800 min-w-max">
                <div className="form-check style-check flex items-center">
                    <Checkbox
                        className="border border-neutral-500 w-4 h-4"
                    />
                </div>
                <Button variant="link" className="!p-0 bg-transparent starred-button icon text-xl text-neutral-500 dark:text-neutral-300 line-height-1 flex">
                    <Star className="w-4" />
                </Button>
                <Link href="/email-details" className="text-neutral-600 dark:text-neutral-200 font-medium text-base text-line-1 w-[190px]">System</Link>
                <Link href="/email-details" className="text-neutral-600 dark:text-neutral-200 font-medium mb-0 line-clamp-1 max-w-[740px]">Grant budget alert — Creative Writing Fellowship is 75% spent ($18,750 of $25,000)</Link>
                <span className="text-neutral-600 dark:text-neutral-200 font-medium min-w-max-content ms-auto">Feb 28</span>
            </li>
            <li className="email-item px-6 py-4 flex gap-4 items-center border-b last:border-0 border-neutral-200 dark:border-slate-700 cursor-pointer hover:bg-neutral-200 dark:hover:bg-slate-800 min-w-max">
                <div className="form-check style-check flex items-center">
                    <Checkbox
                        className="border border-neutral-500 w-4 h-4"
                    />
                </div>
                <Button variant="link" className="!p-0 bg-transparent starred-button icon text-xl text-neutral-500 dark:text-neutral-300 line-height-1 flex">
                    <Star className="w-4" />
                </Button>
                <Link href="/email-details" className="text-neutral-600 dark:text-neutral-200 font-medium text-base text-line-1 w-[190px]">James Carter</Link>
                <Link href="/email-details" className="text-neutral-600 dark:text-neutral-200 font-medium mb-0 line-clamp-1 max-w-[740px]">Submitted expense — $54.99 for Adobe Creative Cloud monthly subscription</Link>
                <span className="text-neutral-600 dark:text-neutral-200 font-medium min-w-max-content ms-auto">Feb 25</span>
            </li>
        </ul>
    );
};

export default EmailList;